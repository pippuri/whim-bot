'use strict';

const Promise = require('bluebird');
const utils = require('../utils');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const stateMachine = require('../../lib/states/index').StateMachine;
const Booking = require('./Booking');

/**
 * An encapsulation of Leg that handles the operations
 * to create, retrieve, list and cancel the leg.
 */
class Leg {

  /**
   * A factory method that constructs the leg from a DAO
   *
   * @param {object} legInoput as a raw leg object
   * @param {string} identityId as user's UUID
   */
  constructor(legInput, identityId) {
    // Assign the data object with a frozen copy
    this.leg = utils.cloneDeep(legInput);

    // assign/remove  proporties if missing
    if (!this.leg.state) {
      this.leg.state = 'START';
    }
    if (!this.leg.id) {
      this.leg.id = utils.createId();
    }
    if (this.leg.signature) {
      delete this.leg.signature;
    }
    if (this.leg.booking) {
      this.leg.booking = new Booking(this.leg.booking, identityId);
    }
  }

  /**
   * Creates and persists a new leg
   * @static
   * @param {object} legInput The configuration object
   * @param {string} identityId as user's UUID
   * @param {boolean} skipInsert set as true if the leg should NOT be inserted into database
   * @return {Promise -> Leg}
   */
  static create(legInput, identityId, skipInsert) {
    if (typeof skipInsert === 'undefined') {
      skipInsert = false;
    }
    if (typeof skipInsert !== 'boolean') {
      Promise.reject(new MaaSError('skipInsert need to be true or false', 400));
    }
    return validator.validate('core:aws-units#definitions/identityId', identityId)
      .then(_result => new Leg(legInput, identityId))
      .then(leg => {
        // Automatically accept all the legs that we cannot create bookings for
        if (!leg._isBookableLeg()) {
          return Promise.resolve(leg);
        }
        return Booking.create({
          leg: leg.leg,
        }, identityId, skipInsert)
          .then(booking => {
            leg.leg.booking = booking;
            return Promise.resolve(leg);
          });
      })
      .then(leg => leg._changeState('PLANNED'))
      .then(leg => {
        if (skipInsert) {
          console.info(`[Leg] Created '${leg.leg.id}'`);
          return Promise.resolve(leg);
        }
        return models.Leg.query()
          .insert(leg.leg)
          .then(() => {
            console.info(`[Leg] Created and saved '${leg.leg.id}'`);
            return Promise.resolve(leg);
          });
      });
  }

  /**
   * Retrieves existing leg with id
   * @static
   * @param {string} leg UUID
   * @return {Promise -> Leg}
   */
  static retrieve(legId) {
    return Promise.reject(new Error('Not implemented'));
  }

  /**
   * Pay leg. Since there is no fare used for leg, the payment is delegated to booking if one exists.
   * @param {object} [trx] Objection transaction object.
   * @return {Promise -> Leg}
   */
  pay(trx) {
    if (!this._isValidStateChange('PAID')) {
      return Promise.reject(new MaaSError(`This leg cannot be paid because now '${this.leg.state}'`, 400));
    }
    console.info(`[Leg] Starting payment of '${this.leg.id}' within state '${this.leg.state}'...`);
    const originalState = this.leg.state;
    return this._changeState('PAID')
      .then(() => {
        if (!this.leg.booking) {
          return Promise.resolve();
        }
        return this.leg.booking.pay(trx);
      })
      .then(() => {
        let model = models.Leg;
        model = trx ? model.bindTransaction(trx) : model;
        return model
          .query()
          .patch({ state: this.leg.state })
          .where('id', this.leg.id);
      })
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Leg] Successful payment of '${this.leg.id}'`);
        return Promise.resolve(this);
      })
      .catch(err => {
        this.leg.state = originalState;
        return Promise.reject(new Error(`Leg '${this.leg.id}' payment failed: ` + err));
      });
  }

  /**
   * Reserve the leg. Since leg does not have means to reserve, delegate to booking if exists.
   * @return {Promise -> Leg}
   */
  reserve() {
    if (!this._isValidStateChange('ACTIVATED')) {
      return Promise.reject(new MaaSError(`This leg cannot be reserved because now '${this.leg.state}'`, 400));
    }

    console.info(`[Leg] Starting to reserve leg '${this.leg.id}' within state '${this.leg.state}'...`);

    let bookingReserve;
    if (!this.leg.booking) {
      bookingReserve = Promise.resolve();
    } else {
      bookingReserve = this.leg.booking.reserve();
    }

    let bookingError;
    return bookingReserve
      .then(() => {
        return this._changeState('ACTIVATED');
      })
      .catch(err => {
        console.error(`[Leg] '${this.leg.id}' Failed to reserve booking:`, err);
        bookingError = err.message || err;
        return this._changeState('CANCELLED_WITH_ERRORS');
      })
      .then(() => models.Leg
        .query()
        .patch({ state: this.leg.state })
        .where('id', this.leg.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        if (this.leg.state === 'CANCELLED_WITH_ERRORS') {
          return Promise.reject('Booking failed: ' + bookingError);
        }
        console.info(`[Leg] '${this.leg.id}' reserved with state '${this.leg.state}'`);
        return Promise.resolve(this);
      })
      .catch(err => {
        console.error(`[Leg] Failed reserving of '${this.leg.id}':`, err);
        return Promise.reject(new Error(`Failed to reserve leg '${this.leg.id}':` + err));
      });
  }

  /**
   * Cancels the leg.
   * @return {Promise -> Leg}
   */
  cancel() {
    if (!this._isValidStateChange('CANCELLED') && !this._changeState('CANCELLED_WITH_ERRORS')) {
      return Promise.reject(new MaaSError(`This leg cannot be cancelled because now '${this.leg.state}'`, 400));
    }

    console.info(`[Leg] Starting to cancel leg '${this.leg.id}' within state '${this.leg.state}'...`);

    let bookingCancel;
    if (!this.leg.booking) {
      bookingCancel = Promise.resolve();
    } else {
      bookingCancel = this.leg.booking.cancel();
    }

    return bookingCancel
      .then(() => {
        return this._changeState('CANCELLED');
      })
      .catch(err => {
        console.error(`[Leg] '${this.leg.id}' Failed to cancel booking: :`, err);
        return this._changeState('CANCELLED_WITH_ERRORS');
      })
      .then(() => models.Leg
        .query()
        .patch({ state: this.leg.state })
        .where('id', this.leg.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Leg] '${this.leg.id}' cancelled with state '${this.leg.state}'`);
        if (this.leg.state === 'CANCELLED_WITH_ERRORS') {
          return Promise.reject(this);
        }
        return Promise.resolve(this);
      })
      .catch(err => {
        console.error(`[Leg] Failed cancellation of '${this.leg.id}':` + err);
        return Promise.reject(new Error(`Failed to cancel leg '${this.leg.id}':` + err));
      });
  }

  /**
   * Returns leg as JSON string
   *
   * @return {string} leg
   */
  toJSON() {
    return utils.cloneDeep(this.leg);
  }

  /**
   * Returns leg as immutable Javascript object
   *
   * @return {object} booking
   */
  toObject() {
    return JSON.parse(JSON.stringify(this.leg));
  }

  /**
   * Validates the state change
   *
   * @param {string} new state
   * @return {boolean} true if state change valid, false otherwise
   */
  _isValidStateChange(state) {
    let result = false;
    if (stateMachine.isStateValid('Leg', this.leg.state, state)) {
      result = true;
    }
    return result;
  }

  /**
   * Change leg state and log the state change
   * @param {string} new state
   * @return {Promise -> Leg}
   */
  _changeState(state) {
    const old_state = this.leg.state;
    this.leg.state = state;
    return stateMachine.changeState('Leg', this.leg.id, old_state, this.leg.state)
      .then(() => this);
  }

  /**
  * Checks if the leg is bookable or not
  *
  * @return {boolean} true if the leg is bookable, false otherwise
  */
  _isBookableLeg() {
    switch (this.leg.mode) {
      // Erraneous data
      case 'undefined':
        throw new Error(`No mode available for leg ${JSON.stringify(this.leg, null, 2)}`);
      // Manual modes, no TSP needed
      case 'WAIT':
      case 'TRANSFER':
      case 'WALK':
        return false;
      // All the rest (MaaS should provide a ride)
      default:
        return true;
    }
  }


}

module.exports = Leg;
