'use strict';

const Promise = require('bluebird');
const utils = require('../utils');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const maasOperation = require('../../lib/maas-operation');
const stateMachine = require('../../lib/states/index').StateMachine;
const tsp = require('../../lib/tsp');

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
  constructor(booking) {
    // Assign the data object with a frozen copy
    this.booking = booking;
    if (!this.booking.state) {
      this.booking.state = 'START';
    }
  }

  /**
   * Validates a given DAO that it is a valid booking
   * @static
   * @param {object} booking The configuration object
   * @param {string} identityId as user's UUID
   * @return {Promise -> undefined}
   */
  static validateInput(bookingInput, identityId) {
    return Promise.resolve() //validator.validate('core:booking#definitions/booking', bookingInput)
      .then(result => {
        let reply;
        if (result) {
          reply = Promise.reject(result);
        } else {
          reply = Promise.resolve();
        }
        return reply;
      });
  }

  /**
   * Creates and persists a new booking
   * @static
   * @param {object} bookingInput The configuration object
   * @return {Promise -> Booking}
   */
  static create(bookingInput, identityId) {
    return Promise.all([
      Booking.validateInput(bookingInput),
      Promise.resolve(), //validator.validate('core:units#definitions/uuid', identityId),
    ])
    .then(() => {
      if (!tsp.supportsAction('book', bookingInput.leg.agencyId)) {
        const message = `The given agency ${bookingInput.leg.agencyId.agencyId} does not support create.`;
        return Promise.reject(new MaaSError(message, 400));
      }
      return utils.validateSignatures(bookingInput);         // Validate request signature
    })
    .then(validatedBookingInput => {
      const booking = new Booking(validatedBookingInput);
      booking._changeBookingState('PENDING')
        .then(() => models.Booking.query().insert(booking.booking))
        .then(() => {
          console.info(`Creation success of booking ${booking.booking.id}, agencyId ${booking.booking.leg.agencyId}.`);
          return Promise.resolve(booking);
        });
    });
  }

  /**
   * Retrieves existing booking with id
   * @static
   * @param {string} booking UUID
   * @return {Promise -> Booking}
   */
  static retrieve(bookingId) {
    return Promise.resolve() //validator.validate('core/units.json#definitions/uuid', bookingId)
      .then(result => models.Booking.query())
      .findById(bookingId)
      .then(booking => {
        if (!booking) {
          const message = `No booking found with bookingId '${bookingId}'`;
          return Promise.reject(new MaaSError(message, 404));
        }

        return Promise.resolve(new Booking(booking));
      });
  }

  static query(params) {
    return Promise.reject(new MaaSError('Not implemented', 500));
  }

  /**
   * Validates if booking is owned by given user.
   * @param {string} identityId as user's UUID
   * @return {Promise -> undefined}
   */
  validateOwnership(identityId) {
    return Promise.resolve() //validator.validate('core/units.json#definitions/uuid', identityId)
      .then(() => {
        let reply = Promise.resolve();
        if (this.booking.customer.identityId !== identityId) {
          reply = Promise.reject(new MaaSError(`Booking ${this.booking.idd} not owned by the user`, 403));
        }
        return reply;
      });
  }

  /**
   * Pay booking
   * @return {Promise -> undefined}
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
            console.info(`Paying success of booking ${this.booking.id}, agencyId ${this.booking.leg.agencyId}.`);
            return Promise.resolve();
          });
      })
      .catch(err => {
        console.error('Booking: failed to pay, err', err);
        return this._changeBookingState('PENDING')
          .then(() => Promise.reject(new MaaSError(`Booking ${this.booking.id} pay failed: ` + err, 400)));
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

    if (!tsp.supportsAction('book', this.booking.leg.agencyId)) {
      const message = `The given agency ${this.booking.leg.agencyId.agencyId} does not support create.`;
      return Promise.reject(new MaaSError(message, 400));
    }

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
            email: profile.email || `maasuser-${profile.phone}@maas.fi`,
          },
        });
        return tsp.createBooking(reservation)
          .then(reservedBooking => {
            this.booking = reservedBooking;
            return this._changeBookingState('RESERVED');
          })
          .catch(error => {
            console.warn(`TSP reservation failed: ${error.message}, ${JSON.stringify(error, null, 2)}`);
            console.warn('This resevation caused the error: ' + JSON.stringify(reservation, null, 2));

            return Promise.all([
              this._changeBookingState('REJECTED'),
              maasOperation.updateBalance(this.booking.customer.identityId, oldBalance), // Refunding
            ])
            .spread((rejectedBooking, updateResponse) => {
              this.booking = rejectedBooking;
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
        console.info(`Reservation success of booking ${this.booking.id}, agencyId ${this.booking.leg.agencyId}.`);
        return Promise.resolve(this);
      });
  }

  /**
   * Cancels the booking.
   * @return {Promise -> undefined}
   */
  cancel() {
    if (!this._isValidStateChange('CANCELLED')) {
      return Promise.reject(new MaaSError('This booking cannot be cancelled.', 400));
    }

    if (!tsp.supportsAction('cancel', this.booking.leg.agencyId)) {
      const message = `The given agency ${this.booking.leg.agencyId.agencyId} does not support cancel.`;
      return Promise.reject(new MaaSError(message, 400));
    }

    return tsp.cancelBooking(this.booking)
      .catch(error => {
        console.warn(`Booking ${this.booking.id}, agencyId ${this.booking.leg.agencyId}, cancellation failed, ${error.message}, ${JSON.stringify(error)}`);
        console.warn(error.stack);
        return Promise.reject(error);
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
        return Promise.resolve();
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
