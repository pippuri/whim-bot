'use strict';

const Promise = require('bluebird');
const utils = require('../utils');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const maasOperation = require('../../lib/maas-operation');
const stateMachine = require('../../lib/states/index').StateMachine;
const TSPFactory = require('../../lib/tsp/TransportServiceAdapterFactory');

/**
 * An encapsulation of Booking that handles the operations
 * to create, retrieve, list and cancel the booking.
 */
class Booking {

  /**
   * A factory method that constructs the booking from a DAO
   *
   * @param {object} booking a raw booking object (e.g. JSON object)
   */
  constructor(bookingInput, identityId) {
    // Assign the data object with a frozen copy
    this.booking = utils.cloneDeep(bookingInput);

    if (!this.booking.customer) {
      this.booking.customer = {};
    }

    // validation of mandatory data
    if (identityId && this.booking.customer.identityId) {
      throw new MaaSError('Cannot reassign owner of the booking when created', 400);
    }
    if (!identityId && !this.booking.customer.identityId) {
      throw new MaaSError('Booking cannot be initialized without owner', 400);
    }
    if (!this.booking.leg) {
      throw new MaaSError('Booking cannot be initialized without leg', 400);
    }
    if (!this.booking.leg.agencyId) {
      throw new MaaSError('Booking cannot be initialized without agencyId', 400);
    }

    // assign mandatory proporties if missing
    if (!this.booking.state) {
      this.booking.state = 'START';
    }
    if (!this.booking.id) {
      this.booking.id = utils.createId();
    }
    if (!this.booking.customer.identityId) {
      this.booking.customer.identityId = identityId;
    }
  }

  /**
   * Validates a given DAO that it is a valid booking
   * @static
   * @param {object} booking The configuration object
   * @param {string} identityId as user's UUID
   * @return {Promise -> undefined}
   */
  static validateInput(bookingInput) {
    return Promise.resolve(); //validator.validate('core:agency-option', bookingInput);
  }

  /**
   * Creates and persists a new booking
   * @static
   * @param {object} bookingInput The configuration object
   * @param {string} identityId as user's UUID
   * @return {Promise -> Booking}
   */
  static create(bookingInput, identityId) {
    return validator.validate('core:aws-units#definitions/identityId', identityId)
      .then(_result => new Booking(bookingInput, identityId))
      .then(booking => booking.assignTransport())
      .then(booking => {
        return booking._changeBookingState('PENDING')
          .then(() => models.Booking.query().insert(booking.booking))
          .then(() => {
            console.info(`[Booking] Created '${booking.booking.id}', agencyId ${booking.booking.leg.agencyId}.`);
            return Promise.resolve(booking);
          });
      });
  }

  /**
   * Retrieves existing booking with id
   * @static
   * @param {string} booking UUID
   * @param {booleam} refresh Set to fetch status from TSP instead of latest copy in DB.
   * @return {Promise -> Booking}
   */
  static retrieve(bookingId, refresh) {
    if (!refresh) {
      refresh = false;
    }
    if (typeof refresh !== 'boolean') {
      return Promise.reject(new MaaSError('Bad parameter value of \'refresh\', need to be true/false', 400));
    }
    return validator.validate('core:units#definitions/uuid', bookingId)
      .then(_result => models.Booking.query().findById(bookingId))
      .then(bookingData => {
        if (!bookingData) {
          const message = `No booking found with bookingId '${bookingId}'`;
          return Promise.reject(new MaaSError(message, 404));
        }
        return Promise.resolve(new Booking(bookingData));
      })
      .then(booking => booking.assignTransport())
      .then(booking => {
        if (refresh) {
          return booking._refresh();
        }
        return Promise.resolve(booking);
      });
  }

  /**
   * Makes a query with given parameters
   * @static
   * @param {string} identityId
   * @param {string} startTime
   * @param {string} endTime
   * @param {array} states
   * @return {Promise -> Array[Booking]}
   */
  static query(identityId, startTime, endTime, states) {
    let query = models.Booking.query()
      .whereRaw('customer ->> \'identityId\' = ?', [identityId]);

    if (typeof startTime !== typeof undefined) {
      query = query.whereRaw('leg ->> \'startTime\' = ?', [startTime]);
    }

    if (typeof endTime !== typeof undefined) {
      query = query.whereRaw('leg ->> \'endTime\' = ?', [endTime]);
    }

    if (states.length > 0) {
      query = query.whereIn('state', states);
    }

    return query
      .orderByRaw('leg ->> \'startTime\'')
      .then(results => Promise.map(results, bookingData => {
        return Promise.resolve(new Booking(bookingData))
          .then(booking => booking.assignTransport())
          .then(booking => Promise.resolve(booking));
      }));
  }

  /**
   * Validates if booking is owned by given user.
   * @param {string} identityId as user's UUID
   * @return {Promise -> Booking}
   */
  validateOwnership(identityId) {
    return validator.validate('core:aws-units#definitions/identityId', identityId)
      .then(_result => {
        if (this.booking.customer.identityId !== identityId) {
          return Promise.reject(new MaaSError(`Booking ${this.booking.id} not owned by the user`, 403));
        }
        return Promise.resolve(this);
      });
  }

  /**
   * Creates transport adapter access based on agencyId
   * @return {Promise -> Booking}
   */
  assignTransport() {
    return TSPFactory.createFromAgencyId(this.booking.leg.agencyId)
      .then(tsp => {
        this.tsp = tsp;
        return Promise.resolve(this);
      });
  }

  /**
   * Refesh booking status from TSP
   * @return {Promise -> Booking}
   */
  refresh() {
    console.info(`[Booking] Refreshing booking ${this.booking.id} for agencyId ${this.booking.leg.agencyId}...`);

    if (!this.tsp.supportsOperation('retrieve')) {
      return Promise.resolve(this);
    }

    return this.tsp.retrieve(this.booking.tspId, this.booking.leg.agencyId)
      // is mergeBookingDelta() needed anymore?
      // .then(updatedBooking => this.tsp.mergeBookingDelta(this.booking, updatedBooking))
      .then(updatedBooking => {
        // Don't accept invalid new states
        // TODO: actually we could run validator here, validator.validate('core:booking#definitions/booking', updatedBooking)
        if (typeof updatedBooking.state === 'undefined') {
          return Promise.reject(new MaaSError(`Booking ${this.booking.id} cannot be refreshed; gets invalid state`, 403));
        }
        return updatedBooking;
      })
      .then(verifiedBooking => {
        // Update state if TSP has changed it
        if (verifiedBooking.state !== this.booking.state) {
          console.info(`[Booking] TSP changed state '${verifiedBooking.state}' -> '${this.booking.state}'`);
          return this._changeBookingState(verifiedBooking.state)
            .then(verifiedBooking);
        }
        return Promise.resolve(verifiedBooking);
      })
      .then(verifiedBooking => {
        // set new booking information into object
        this.booking = utils.merge(this.booking, verifiedBooking);
        return Promise.resolve();
      })
      .then(() => {
        // persist and return new booking
        return models.Booking.query()
          .updateAndFetchById(this.booking.id, this.booking)
          .then(update => {
            if (typeof update === 'undefined') {
              const message = `Updating failed; booking ${this.booking.id} not found in the database`;
              console.error('[Booking] ', message);
              return Promise.reject(new Error(message));
            }
            return Promise.resolve(this);
          });
      });
  }

  /**
   * Pay booking
   * @return {Promise -> Booking}
   */
  pay() {
    if (!this._isValidStateChange('PAID')) {
      return Promise.reject(new MaaSError('This booking cannot be paid.', 400));
    }
    return maasOperation.fetchCustomerProfile(this.booking.customer.identityId) // Get customer information
      .then(profile => {
        // Reduce points and put booking in 'PAID' state
        return maasOperation.computeBalance(this.booking.terms.price.amount, profile)
          .then(calculatedBalance => {
            return maasOperation.updateBalance(this.booking.customer.identityId, calculatedBalance); // Deduction
          })
          .then(() => this._changeBookingState('PAID'))
          .then(() => {
            return models.Booking.query()
              .patch({ state: this.booking.state })
              .where('id', this.booking.id);
          })
          .then(updateCount => {
            if (updateCount === 0) {
              return Promise.reject(new Error(`Booking ${this.booking.id} failed to update to PAID: Not found`));
            }
            console.info(`[Booking] Successful payment of '${this.booking.id}', agencyId ${this.booking.leg.agencyId}.`);
            return Promise.resolve(this);
          });
      })
      .catch(err => {
        console.error('[Booking] failed to pay, err', err);
        return this._changeBookingState('PENDING')
          .then(() => Promise.reject(new Error(`Booking ${this.booking.id} pay failed: ` + err)));
      });
  }

  /**
   * Make a resevation.
   * @return {Promise -> Booking}
   */
  reserve() {
    if (!this._isValidStateChange('RESERVED')) {
      return Promise.reject(new MaaSError('This booking cannot be reserved.', 400));
    }

    if (!this.tsp.supportsOperation('reserve')) {
      const message = `The given agency ${this.booking.leg.agencyId.agencyId} does not support create.`;
      return Promise.reject(new MaaSError(message, 400));
    }

    let errorMessage;

    return maasOperation.fetchCustomerProfile(this.booking.customer.identityId) // Get customer information
      .then(profile => {
        const reservation = Object.assign({}, this.booking, {
          id: utils.createId(),
          customer: {
            identityId: profile.identityId,
            title: profile.title || 'mr',
            firstName: profile.firstName || 'John',
            lastName: profile.lastName || 'Doe',
            phone: profile.phone,
            email: profile.email || `maasuser-${profile.phone.replace(/\s/g, '').replace(/^[\+/]/g, '')}@maas.fi`,
          },
        });
        return this.tsp.reserve(reservation)
          .then(reservedBooking => {
            // set new booking information into object
            this.booking = utils.merge(this.booking, reservedBooking);
            return this._changeBookingState('RESERVED');
          })
          .catch(error => {
            console.warn(`[Booking] '${this.booking.id}' TSP reservation failed: ${error.message}, ${JSON.stringify(error, null, 2)}`);
            errorMessage = `${error.message}`;
            return Promise.all([
              this._changeBookingState('REJECTED'),
              maasOperation.updateBalance(this.booking.customer.identityId, this.booking.terms.price.amount), // Refunding
            ]);
          });
      })
      .then(() => {
        return models.Booking.query()
          .update(this.booking)
          .where('id', this.booking.id);
      })
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new MaaSError(`Booking ${this.booking.id} failed to update: Not found`, 404));
        }
        if (this.booking.state === 'REJECTED') {
          return Promise.reject(new Error(`Booking ${this.booking.id} reservation failed: ` + errorMessage));
        }
        console.info(`[Booking] Reservation success of '${this.booking.id}', agencyId ${this.booking.leg.agencyId}.`);
        return Promise.resolve(this);
      });
  }

  /**
   * Cancels the booking.
   * @return {Promise -> Booking}
   */
  cancel() {
    if (!this._isValidStateChange('CANCELLED')) {
      return Promise.reject(new MaaSError('This booking cannot be cancelled.', 400));
    }

    if (!this.tsp.supportsOperation('cancel')) {
      const message = `The given agency ${this.booking.leg.agencyId.agencyId} does not support cancel.`;
      return Promise.reject(new MaaSError(message, 400));
    }

    return this.tsp.cancel(this.booking.id)
      .catch(error => {
        const message = `Booking ${this.booking.id}, agencyId ${this.booking.leg.agencyId}, cancellation failed, ${error.message}`;
        console.warn(`[Booking] '${this.booking.id}', agencyId ${this.booking.leg.agencyId}, cancellation failed, ${error.message}, ${JSON.stringify(error)}`);
        console.warn(error.stack);
        return Promise.reject(new Error(message));
      })
      .then(() => {
        console.info(`Booking ${this.booking.id}, agencyId ${this.booking.leg.agencyId} cancelled from the TSP side`);
        return this._changeBookingState('CANCELLED');
      })
      .then(() => {
        return models.Booking.query()
          .patch({ state: this.booking.state })
          .where('id', this.booking.id);
      })
      .then(updateCount => {
        console.info(`Booking ${this.booking.id}, agencyId ${this.booking.leg.agencyId}, state updated.`);
        if (updateCount === 0) {
          return Promise.reject(new MaaSError(`Booking ${this.booking.id} failed to update: Not found`, 404));
        }
        console.info(`Cancellation success of booking ${this.booking.id}, agencyId ${this.booking.leg.agencyId}.`);
        return Promise.resolve(this);
      });
  }

  /**
   * Returns booking as JSON string
   *
   * @return {string} booking
   */
  toJSON() {
    return JSON.stringify(this.booking);
  }

  /**
   * Returns booking as immutable Javascript object
   *
   * @return {object} booking
   */
  toObject() {
    return utils.cloneDeep(this.booking);
  }

  /**
   * Validates the state change
   *
   * @param {string} new state
   * @return {boolean} true if state change valid, false otherwise
   */
  _isValidStateChange(state) {
    let result = false;
    if (stateMachine.isStateValid('Booking', this.booking.state, state)) {
      result = true;
    }
    return result;
  }

  /**
   * Change booking state and log the state change
   * @param {string} new state
   * @return {Promise -> undefined}
   */
  _changeBookingState(state) {
    const old_state = this.booking.state;
    this.booking.state = state;
    return stateMachine.changeState('Booking', this.booking.id || this.booking.bookingId, old_state, this.booking.state);
  }


}

module.exports = Booking;

/* How to use in API end-öoints

bookings-retrieve:

  return Database.init()
    .then(() => Booking.retrieve(event.bookingId))
    .then(booking => booking.validateOwnership(event.identityId))
    .then(booking => {
      if (event.refresh && event.refresh === 'true' || event.refresh === true) {
        return booking.refresh();
      }
      return Promise.resolve(booking);
    })
    .then(booking => formatResponse(booking.toObject()))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(_error);
        });
    });

bookings-create:

  return Database.init()
    .then(() => Booking.create(event.payload, event.identityId))
    .then(booking => booking.pay())
    .then(booking => booking.reserve())
    .then(booking => formatResponse(booking.toObject()))
    .then(bookingData => {
      Database.cleanup()
        .then(() => callback(null, bookingData));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(_error);
        });
    });

bookings-list:

  function formatResponse(bookings) {
    const trimmed = bookings.map(booking => utils.removeNulls(booking.toObject()));

    return Promise.resolve({
      bookings: trimmed,
      maas: {},
    });
  }

  module.exports.respond = (event, callback) => {

    return Promise.all([
      Database.init(),
      parseAndValidateInput(event),
    ])
      .spread((knex, parsed) => Booking.query(parsed.identityId, parsed.startTime, parsed.endTime, parsed.states))
      .then(bookings => formatResponse(bookings))
      .then(response => {
        Database.cleanup()
          .then(() => callback(null, response));
      })
      .catch(_error => {
        console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
        console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
        console.warn(_error.stack);

        // Uncaught, unexpected error
        Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
      });
  };

  bookings-cancel:

    return Database.init()
      .then(() => Booking.retrieve(event.bookingId))
      .then(booking => booking.validateOwnership(event.identityId))
      .then(booking => booking.cancel())
      .then(booking => formatResponse(booking.toObject()))
      .then(response => {
        Database.cleanup()
          .then(() => callback(null, response));
      })
      .catch(_error => {
        console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
        console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

        Database.cleanup()
          .then(() => {
            if (_error instanceof MaaSError) {
              callback(_error);
              return;
            }

            callback(_error);
          });
      });

*/
