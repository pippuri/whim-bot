'use strict';

const awsUnitsSchema = require('maas-schemas/prebuilt/core/aws-units.json');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Profile = require('./Profile');
const Promise = require('bluebird');
const stateMachine = require('../../lib/states/index').StateMachine;
const TSPFactory = require('../../lib/tsp/TransportServiceAdapterFactory');
const unitsSchema = require('maas-schemas/prebuilt/core/units.json');
const utils = require('../utils');
const validator = require('../../lib/validator');

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
    if (identityId && this.booking.customer.identityId && identityId !== this.booking.customer.identityId) {
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

    // assign/remove mandatory proporties
    if (!this.booking.state) {
      this.booking.state = 'START';
    }
    if (!this.booking.id) {
      this.booking.id = utils.createId();
    }
    if (!this.booking.customer.identityId) {
      this.booking.customer.identityId = identityId;
    }
    if (!this.booking.meta) {
      this.booking.meta = {};
    }
    if (this.booking.signature) {
      delete this.booking.signature;
    }
  }

  /**
   * Creates and persists a new booking
   *
   * @static
   *
   * @param {Object} bookingInput The configuration object
   * @param {string} identityId as user's UUID
   * @param {Objection} transaction as objection transaction
   * @param {boolean} [options.skipInsert] - Set true if the booking should NOT be inserted into database.
   * Note! use skipInsert wisely as many object methods, such as pay(), assume the record is persisted.
   *
   * @return {Promise -> Booking}
   */
  static create(bookingInput, identityId, transaction, options) {
    options = options !== undefined ? options : {};
    const skipInsert = typeof options.skipInsert === 'undefined' ? false : options.skipInsert;

    if (!transaction) {
      return Promise.reject(new Error('a started transaction is required for booking creation'));
    }
    if (typeof options !== 'object') {
      return Promise.reject(new Error('options need to be object'));
    }
    if (typeof skipInsert !== 'boolean') {
      return Promise.reject(new Error('skipInsert need to be true or false'));
    }

    return Promise.resolve()
      .then(() => validator.validate(awsUnitsSchema.definitions.identityId, identityId))
      .then(_result => new Booking(bookingInput, identityId))
      .then(booking => booking._addUserData())
      .then(booking => booking.assignTransport())
      .then(booking => booking._changeState('PENDING'))
      .then(booking => {
        if (skipInsert) {
          console.info(`[Booking] Created '${booking.booking.id}', agencyId ${booking.booking.leg.agencyId}.`);
          return Promise.resolve(booking);
        }
        return models.Booking.bindTransaction(transaction)
          .query()
          .insert(booking.booking)
          .then(() => {
            console.info(`[Booking] Created and saved '${booking.booking.id}', agencyId ${booking.booking.leg.agencyId}.`);
            return Promise.resolve(booking);
          });
      });
  }

  /**
   * Retrieves existing booking with id
   *
   * @static
   * @param {string} booking UUID
   * @param {boolean} [options.refresh] - Set to fetch status from TSP instead of latest copy in DB.
   *
   * @return {Promise -> Booking}
   */
  static retrieve(bookingId, options) {
    options = options !== undefined ? options : {};
    const refresh = typeof options.refresh === 'undefined' ? false : options.refresh;

    if (typeof options !== 'object') {
      return Promise.reject(new Error('options need to be object'));
    }
    if (typeof refresh !== 'boolean') {
      return Promise.reject(new Error('\'refresh\' need to be true/false'));
    }

    return validator.validate(unitsSchema.definitions.uuid, bookingId)
      .then(_result => models.Booking.query()
      .findById(bookingId))
      .then(bookingData => {
        if (!bookingData) {
          const message = `No booking found with bookingId '${bookingId}'`;
          return Promise.reject(new MaaSError(message, 404));
        }
        return Promise.resolve(new Booking(bookingData));
      })
      .then(booking => booking.assignTransport())
      .then(booking => {
        if (refresh === true) {
          return booking.refresh();
        }
        return Promise.resolve(booking);
      });
  }

  /**
   * Makes a query with given parameters
   *
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
          .then(booking => booking.assignTransport());
      }));
  }

  /**
   * Checks if a agency Id is supported by booking
   *
   * @static
   * @param agencyId
   * @return {Promise -> Boolean}
   */
  static isAgencyIdSupported(agencyId) {
    // only way to check if a agencyId is supported is to try to create one..
    return TSPFactory.createFromAgencyId(agencyId)
      .then(tsp => {
        return Promise.resolve(true);
      })
      .catch(err => {
        return Promise.resolve(false);
      });
  }

  /**
   * Validates if booking is owned by given user.
   *
   * @param {string} identityId as user's UUID
   * @return {Promise -> Booking}
   */
  validateOwnership(identityId) {
    return validator.validate(awsUnitsSchema.definitions.identityId, identityId)
      .then(_result => {
        if (this.booking.customer.identityId !== identityId) {
          return Promise.reject(new MaaSError(`Booking ${this.booking.id} not owned by the user`, 403));
        }
        return Promise.resolve(this);
      });
  }

  /**
   * Creates transport adapter access based on agencyId
   *
   * @return {Promise -> Booking}
   */
  assignTransport() {
    if (!this.tsp) {
      return TSPFactory.createFromAgencyId(this.booking.leg.agencyId)
        .then(tsp => {
          this.tsp = tsp;
          return Promise.resolve(this);
        });
    }
    return Promise.resolve(this);
  }

  /**
   * Refesh booking status from TSP
   *
   * @return {Promise -> Booking}
   */
  refresh(transaction) {
    return this.assignTransport()
      .then(() => this._refreshWithTSP(transaction));
  }

  _refreshWithTSP(transaction) {
    console.info(`[Booking] Refreshing booking ${this.booking.id} for agencyId ${this.booking.leg.agencyId}...`);

    // return happily if TSP does not support refresh or there is no TSP
    if (!this.tsp.supportsOperation('retrieve') || !this.booking.tspId) {
      console.warn(`[Booking] Refreshing skipped for booking ${this.booking.id}; TSP does not support refresh.`);
      return Promise.resolve(this);
    }

    return this.tsp.retrieve(this.booking.tspId)
      .then(verifiedBooking => {
        // Update state if TSP has changed it
        if (verifiedBooking.state !== this.booking.state) {
          console.info(`[Booking] TSP changed state '${this.booking.state}' -> '${verifiedBooking.state}'`);
          return this._changeState(verifiedBooking.state)
            .then(_this => verifiedBooking);
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
              console.warn('[Booking] ', message);
              return Promise.reject(new Error(message));
            }
            return Promise.resolve(this);
          });
      });
  }

  /**
   * Pay booking
   *
   * If input transaction is given, all database operations here are bound to this transaction. Whoever calls this pay-method, must then commit or rollback the transaction!
   *
   * @param {Object} transaction Objection transaction object.
   * @param {boolean} [options.skipPayment] - Set true not to actually deduct the set fare (e.g. if already paid in itinerary level)
   *
   * @return {Promise -> Booking}
   */
  pay(transaction, options) {
    options = options !== undefined ? options : {};
    const skipPayment = typeof options.skipPayment === 'undefined' ? false : options.skipPayment;
    if (!transaction) {
      return Promise.reject(new Error('a started transaction is required for booking creation'));
    }
    if (typeof options !== 'object') {
      return Promise.reject(new Error('options need to be object'));
    }
    if (typeof skipPayment !== 'boolean') {
      return Promise.reject(new Error('skipPayment not true/false', 400));
    }

    console.info(`[Booking] Paying booking ${this.booking.id} for agencyId ${this.booking.leg.agencyId}...`);

    if (['PAID', 'RESERVED', 'CONFIRMED', 'ACTIVATED'].some(state => state === this.state)) {
      console.warn(`[Booking] Warning, re-payment of booking ${this.booking.id} requested in state '${this.state}', ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('PAID')) {
      const message = `Booking '${this.booking.id}' cannot be paid because it is '${this.booking.state}'`;
      return Promise.reject(new MaaSError(message, 400));
    }

    // Ensure we do have a fare - otherwise we can't pay
    if (skipPayment === false && (typeof this.booking.fare !== 'object' || this.booking.fare === null)) {
      const message = `Booking '${this.booking.id}' cannot be paid because of invalid fare '${JSON.stringify(this.booking.fare)}'`;
      return Promise.reject(new MaaSError(message, 400));
    }

    return Profile.retrieve(this.booking.customer.identityId)
      .then(profile => {
        if (skipPayment === true || this.booking.fare.amount === 0) {
          return Promise.resolve();
        }
        const newBalance = profile.balance - this.booking.fare.amount;
        return Profile.update(this.booking.customer.identityId, { balance: newBalance }, transaction);
      })
      .then(() => this._changeState('PAID'))
      .then(() => {
        return models.Booking.bindTransaction(transaction)
          .query()
          .patch({ state: this.booking.state })
          .where('id', this.booking.id);
      })
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        if (skipPayment === true) {
          console.info(`[Booking] '${this.booking.id}' set as PAID (paying skipped), agencyId '${this.booking.leg.agencyId}'`);
        } else {
          console.info(`[Booking] Successful payment of '${this.booking.id}', agencyId '${this.booking.leg.agencyId}', fare ${this.booking.fare.amount} points`);
        }
        return Promise.resolve(this);
      })
      .catch(err => {
        console.warn(`[Booking] FAILED payment of '${this.booking.id}': ${err.message}`);
        if (err instanceof MaaSError) {
          return Promise.reject(err);
        }
        return Promise.reject(new Error(`Booking '${this.booking.id}' payment failed:  ${err.message}`));
      });
  }

  /**
   * Make a resevation.
   *
   * @return {Promise -> Booking}
   */
  reserve() {
    return this.assignTransport()
      .then(() => this._reserveWithTSP());
  }

  _reserveWithTSP() {
    console.info(`[Booking] Reserving booking ${this.booking.id} for agencyId ${this.booking.leg.agencyId}...`);

    if (this.state === 'RESERVED' || this.state === 'CONFIRMED' || this.state === 'ACTIVATED') {
      console.warn(`[Booking] Warning, re-reservation of booking ${this.booking.id} requested in state '${this.state}', ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('RESERVED')) {
      return Promise.reject(new MaaSError(`Booking '${this.booking.id}' cannot be reserved because the state is '${this.booking.state}'`, 400));
    }

    if (!this.tsp.supportsOperation('reserve')) {
      const message = `The given agency ${this.booking.leg.agencyId.agencyId} does not support reserve.`;
      return Promise.reject(new Error(message));
    }

    let errorMessage;
    let fare = this.booking.fare
               && this.booking.fare.currency === 'POINT'
               && this.booking.fare.amount;
    if (!fare) fare = 0;
    let currentBalance;

    return Profile.retrieve(this.booking.customer.identityId)
      .then(profile => {
        // save current balance for possible refund
        currentBalance = profile.balance;

        // create reservation object for TSP, but don't send identityId
        const customer = utils.cloneDeep(this.booking.customer);
        delete customer.identityId;
        const leg = utils.cloneDeep(this.booking.leg);
        delete leg.agencyId;

        const reservation = {
          leg: leg,
          meta: this.booking.meta,
          customer: customer,
        };
        return this.tsp.reserve(reservation)
          .then(reservedBooking => {
            // Reserved booking always returns a change in state
            // (RESERVED, CONFIRMED or ACTIVATED) - other cases are an error
            console.info(`[Booking] TSP changed state '${this.booking.state}' -> '${reservedBooking.state}'`);

            return this._changeState(reservedBooking.state)
              .then(() => {
                // set new booking information into object
                this.booking = utils.merge(this.booking, reservedBooking);
                return Promise.resolve();
              });
          })
          .catch(error => {
            console.warn(`[Booking] '${this.booking.id}' TSP reservation failed: ${error.message}, ${JSON.stringify(error, null, 2)}`);
            errorMessage = `${error.message}`;
            return this._changeState('REJECTED')
              .then(() => {
                if (fare !== 0) {
                  const restoredBalance = currentBalance + fare;
                  console.info(`[Booking] Refunding ${fare} points for the user`);
                  return Profile.update(this.booking.customer.identityId,
                    { balance: restoredBalance });
                }
                return Promise.resolve();
              });
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
   * Cancels the booking. If the booking is already in a state of CANCELLED, the cancellation will be succesful.
   * If Booking is "active", cancel-operation is tried and the result is either success with state of CANCELLED
   * or rejection with the current state.
   *
   * If input transaction is given, all database operations here
   * are bound to this transaction. Whoever calls this create-method, must then commit or rollback the transaction!
   * The transaction must be created with Itinerary.startTransaction() by caller.
   *
   * @param {object} transaction - Objection transaction object.
   * @param {Object} [options.skipRefund] - Set true not to refund of the booking fare (e.g. if already
   * refunded in itinerary level)
   *
   * @return {Promise -> Booking}
   */
  cancel(transaction, options) {
    if (!transaction) {
      return Promise.reject(new Error('A started transaction is required to cancel Booking'));
    }

    return this.assignTransport()
      .then(() => this._cancelWithTSP(transaction, options));
  }

  /**
   * Cancel the booking from the TSP side
   * If input transaction is given, all database operations here
   * are bound to this transaction. Whoever calls this create-method, must then commit or rollback the transaction!
   * The transaction must be created with Itinerary.startTransaction() by caller.
   *
   * @param {object} transaction - Objection transaction object.
   *
   * @param {Object} [options.skipRefund] - Set true not to refund of the booking fare (e.g. if already
   * refunded in itinerary level)
   *
   * @return {Promise -> Booking}
   */
  _cancelWithTSP(transaction, options) {
    options = options !== undefined ? options : {};
    const skipRefund = typeof options.skipRefund === 'undefined' ? false : options.skipRefund;

    if (typeof options !== 'object') {
      return Promise.reject(new Error('options need to be object'));
    }
    if (typeof skipRefund !== 'boolean') {
      return Promise.reject(new Error('skipRefund need to be true or false'));
    }

    console.info(`[Booking] Starting to cancel booking '${this.booking.id}' with state '${this.booking.state}'...`);

    if (this.state === 'CANCELLED') {
      console.warn(`[Booking] Warning, (re-)cancellation of booking ${this.booking.id} requested, ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('CANCELLED')) {
      return Promise.reject(new MaaSError(`Booking '${this.booking.id}' cannot be cancelled because it is '${this.booking.state}'`, 400));
    }

    if (!this.tsp.supportsOperation('cancel')) {
      const message = `The given agency '${this.booking.leg.agencyId}' does not support cancel.`;
      return Promise.reject(new MaaSError(message, 400));
    }

    let fare = this.booking.fare
               && this.booking.fare.currency === 'POINT'
               && this.booking.fare.amount;
    if (!fare) fare = 0;

    let cancelAction;
    if (this.booking && this.booking.tspId) {
      cancelAction = this.tsp.cancel(this.booking.tspId)
        .then(cancelledBooking => {
          // TSP should return always CANCEL if resevation cancellation is successful
          console.info(`[Booking] TSP changed state '${this.booking.state}' -> '${cancelledBooking.state}'`);
          return this._changeState(cancelledBooking.state)
            .then(() => {
              // set new booking information into object
              this.booking = utils.merge(this.booking, cancelledBooking);
              return Promise.resolve();
            });
        });
    } else {
      cancelAction = this._changeState('CANCELLED');
    }

    let errorMessage;

    return cancelAction
      // refund if needed
      .then(() => {
        if (skipRefund === true || fare === 0 || this.state !== 'CANCELLED') {
          console.info(`[Booking] Skipped refunding; fare ${fare} points`);
          return Promise.resolve();
        }
        console.info(`[Booking] Refunding fare of ${fare} points...`);
        return Profile.retrieve(this.booking.customer.identityId)
          .then(profile => {
            const restoredBalance = profile.balance + fare;
            Profile.update(this.booking.customer.identityId, { balance: restoredBalance }, transaction);
          });
      })
      .then(() => {
        return models.Booking.bindTransaction(transaction).query()
          .update(this.booking)
          .where('id', this.booking.id);
      })
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Booking] Cancellation success of '${this.booking.id}' with state '${this.booking.state}'`);
        return Promise.resolve(this);
      })
      .catch(error => {
        errorMessage = `Booking '${this.booking.id}', agencyId ${this.booking.leg.agencyId}, cancellation failed: ${error.message || error}`;
        console.warn(`[Booking] ${errorMessage}`);
        console.warn(error.stack);
        return Promise.reject(errorMessage);
      });
  }

  /**
   * Returns booking as JSON string
   *
   * @return {string} booking
   */
  toJSON() {
    return utils.cloneDeep(this.booking);
  }

  /**
   * Returns booking as immutable Javascript object
   *
   * @return {object} booking
   */
  toObject() {
    return JSON.parse(JSON.stringify(this.booking));
  }

  /**
   * Returns if booking is currently refundable
   *
   * @return {booelean}
   */
  isRefundable() {
    if (['PAID', 'RESERVED'].some(state => state === this.booking.state)) {
      return true;
    }
    return false;
  }

  /**
   * Get Booking fare in points. Returns null if fare cannot be expressed in points.
   *
   * @return {number}
   * @return {null} in case we cannot return fare in points
   */
  fareInPoints() {
    return this.booking.fare
      && this.booking.fare.currency === 'POINT'
      && this.booking.fare.amount || null;
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
  _changeState(state) {
    const old_state = this.booking.state;
    this.booking.state = state;
    return stateMachine.changeState('Booking', this.booking.id, old_state, this.booking.state)
      .then(() => this);
  }

  /**
   * Helper to fetch user profile and copy needed data into the booking.
   *
   * @return {Promise -> Booking}
   */
  _addUserData() {
    // update bookings user data
    return Profile.retrieve(this.booking.customer.identityId)
      .then(profile => {
        this.booking.customer = Object.assign(this.booking.customer, {
          firstName: profile.firstName || 'John',
          lastName: profile.lastName || 'Doe',
          phone: profile.phone,
          email: profile.email || `maasuser-${profile.phone.replace(/\s/g, '').replace(/^[\+/]/g, '')}@maas.fi`,
        });
        return Promise.resolve(this);
      });
  }

  /**
   * Get Booking ID
   * @return {string}
   */
  get id() {
    return this.booking.id;
  }

  /**
   * Get Booking state
   * @return {string}
   */
  get state() {
    return this.booking.state;
  }

  /**
   * Get Booking terms
   * @return {Object}
   */
  get terms() {
    return Object.assign({}, this.booking.terms);
  }

  /**
   * Get Booking meta
   * @return {Object}
   */
  get meta() {
    return Object.assign({}, this.booking.meta);
  }

  /**
   * Get Booking leg
   * @return {Object}
   */
  get leg() {
    return Object.assign({}, this.booking.leg);
  }

}

module.exports = Booking;
