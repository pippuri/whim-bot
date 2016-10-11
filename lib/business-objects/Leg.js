'use strict';

const Promise = require('bluebird');
const utils = require('../utils');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const stateMachine = require('../../lib/states/index').StateMachine;
const Booking = require('./Booking');
const awsUnitsSchema = require('maas-schemas/prebuilt/core/aws-units.json');

// Milliseconds before leg start time when beeking
// should be done. Defaults to 30 minutes.
const ACTIVATION_TIME_BEFORE_START = {
  BUS: (10 * 60 * 1000),
  TRAM: (10 * 60 * 1000),
  TRAIN: (25 * 60 * 1000),
  TAXI: (10 * 60 * 1000),
  WALK: (5 * 60 * 1000),
  TRANSFER: (5 * 60 * 1000),
  WAIT: (5 * 60 * 1000),
};

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
    return validator.validate(awsUnitsSchema.definitions.identityId, identityId)
      .then(_result => new Leg(legInput, identityId))
      .then(leg => {
        // check if this is bookable leg and we have supported for given agencyId
        if (leg._isBookableLeg()) {
          return Booking.isAgencyIdSupported(leg.leg.agencyId)
            .then(isSupported => {
              if (isSupported !== true) {
                console.warn(`[Leg] Warning! AgencyId '${leg.leg.agencyId}' not supported, booking creation skipped`);
                return Promise.resolve(leg);
              }

              const legData = leg.toBookingSpecificLeg();
              // If no fare information is given, assume zero-cost fare
              // TODO Change this when fares are moved from itinerary level to leg
              const fare = leg.fare || { amount: 0, unit: 'POINTS' };

              return Booking.create({ leg: legData, fare }, identityId, skipInsert)
                .then(booking => {
                  leg.leg.booking = booking;
                  return Promise.resolve(leg);
                });
            });
        }
        return Promise.resolve(leg);
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
    if (this.state === 'PAID') {
      console.warn(`[Leg] Warning, re-payment of leg ${this.leg.id} requested in state '${this.state}', ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('PAID')) {
      return Promise.reject(new MaaSError(`This leg cannot be paid because it is '${this.leg.state}'`, 400));
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
   * Activate the leg. If tickes are needed for the leg, delegate it to the Booking.
   * @return {Promise -> Leg}
   */
  activate() {
    console.info(`[Leg] Starting to activate leg '${this.leg.id}' within state '${this.leg.state}'...`);

    if (this.state === 'ACTIVATED') {
      console.warn(`[Leg] Warning, re-activation of leg ${this.leg.id} requested, refreshing instead.`);
      if (this.leg.booking) {
        return this.leg.booking.refresh()
          .then(booking => {
            // TODO: check if booking has been cancelled or failed, change leg state?
            return Promise.resolve(this);
          });
      }
    }

    if (!this._isValidStateChange('ACTIVATED')) {
      return Promise.reject(new MaaSError(`Leg '${this.leg.id}' cannot be activated because the state is '${this.leg.state}'.`, 400));
    }

    let bookingReserve;
    if (!this.leg.booking) {
      bookingReserve = Promise.resolve();
    } else {
      bookingReserve = this.leg.booking.reserve();
    }

    let bookingError;
    return bookingReserve
      .then(() => this._changeState('ACTIVATED'))
      .catch(err => {
        bookingError = err.message || err;
        console.error(`[Leg] '${this.leg.id}' Failed to activate; error with booking!`);
        console.error(err.stack);
        return this._changeState('CANCELLED_WITH_ERRORS');
      })
      .then(() => models.Leg
        .query()
        .patch({ state: this.leg.state })
        .where('id', this.leg.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error(`Leg ${this.leg.id} not found from database!`));
        }
        if (this.leg.state === 'CANCELLED_WITH_ERRORS') {
          return Promise.reject(new Error(`Failed to get a booking for the leg: ${bookingError}`));
        }
        console.info(`[Leg] '${this.leg.id}' activated with with state '${this.leg.state}'`);
        return Promise.resolve(this);
      })
      .catch(err => {
        console.error(`[Leg] Failed activating of '${this.leg.id}':`, err.message);
        return Promise.reject(new Error(`Failed to activate leg '${this.leg.id}':` + err.message));
      });
  }

  /**
   * Cancels the leg. If the leg is already in a state that can be consider cancelled, the operation is
   * success and current state remains. If Leg is "active", cancel operation is tried and result
   * is successful either with new state of CANCELLED or CANCELLED_WITH_ERRORS. If Leg is ended or
   * finished already, the cancel operation will fails as illegal state transtion.
   *
   * @return {Promise -> Leg}
   */
  cancel() {
    console.info(`[Leg] Starting to cancel leg '${this.leg.id}' with state '${this.leg.state}'...`);

    if (['CANCELLED', 'CANCELLED_WITH_ERRORS'].indexOf(this.state) !== -1) {
      console.warn(`[Leg] Warning, (re-)cancellation of leg '${this.leg.id}' requested, ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('CANCELLED') && !this._changeState('CANCELLED_WITH_ERRORS')) {
      return Promise.reject(new MaaSError(`This leg cannot be cancelled because it is '${this.leg.state}'`, 400));
    }

    const bookingCancel = (this.leg.booking) ? this.leg.booking.cancel() : Promise.resolve();
    return bookingCancel
      .then(() => this._changeState('CANCELLED'))
      .catch(err => {
        console.error(`[Leg] '${this.leg.id}' failed to cancel booking: ${err.message}`);
        return this._changeState('CANCELLED_WITH_ERRORS');
      })
      .then(() => models.Leg
        .query()
        .patch({ state: this.leg.state })
        .where('id', this.leg.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error(`Leg '${this.leg.id}' not found from the database`));
        }
        console.info(`[Leg] '${this.leg.id}' cancelled resulted state '${this.leg.state}'`);
        if (this.state !== 'CANCELLED') {
          return Promise.reject(new Error(`Cancellation of '${this.leg.id}' done with errors.`));
        }
        return Promise.resolve(this);
      })
      .catch(err => {
        console.error(`[Leg] Failed cancellation of '${this.leg.id}': ${err.message}`);
        return Promise.reject(new Error(`Failed to cancel leg '${this.leg.id}': ${err.message}`));
      });
  }

  /**
   * Finish the leg.
   * @return {Promise -> Leg}
   */
  finish() {
    console.info(`[Leg] Starting to finish leg '${this.leg.id}' within state '${this.leg.state}'...`);

    if (['CANCELLED', 'CANCELLED_WITH_ERRORS', 'FINISHED'].indexOf(this.state) !== -1) {
      console.warn(`[Leg] Warning, (re-)finishing of leg '${this.leg.id}' requested, ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('FINISHED')) {
      return Promise.reject(new MaaSError(`This leg cannot be finished because it is '${this.leg.state}'`, 400));
    }

    // do one more booking refesh if we have booking
    let bookingAction;
    if (this.leg.booking) {
      bookingAction = this.leg.booking.refresh();
    } else {
      bookingAction = Promise.resolve();
    }

    return bookingAction
      .catch(err => {
        // ignore booking refesh issues now
        console.warn(`[Leg] '${this.leg.id}' Failed to finish; error with booking!`);
        console.warn(err.message || err);
        return Promise.resolve();
      })
      .then(() => this._changeState('FINISHED'))
      .then(() => models.Leg
        .query()
        .patch({ state: this.leg.state })
        .where('id', this.leg.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Leg] '${this.leg.id}' finished with state '${this.leg.state}'`);
        return Promise.resolve(this);
      })
      .catch(err => {
        console.error(`[Leg] Failed finishing of '${this.leg.id}':`, err);
        return Promise.reject(new Error(`Failed to finish leg '${this.leg.id}':` + err));
      });
  }

  /**
   * Helpers to figure out leg information
   */
  isTransport() {
    return (['BUS', 'TRAIN', 'TRAM', 'FERRY', 'SUBWAY', 'PERSONAL', 'TAXI'].indexOf(this.leg.mode) !== -1);
  }

  isWalking() {
    return this.leg.mode === 'WALK';
  }

  isWaiting() {
    return this.leg.mode === 'TRANSFER' || this.leg.mode === 'WAIT';
  }

  activationTime() {
    return this.leg.startTime - (ACTIVATION_TIME_BEFORE_START[this.leg.mode] || (30 * 60 * 1000));
  }

  destination() {
    return this.leg.to && this.leg.to.name;
  }

  /**
   * Return booking specific subset of leg information
   */
  toBookingSpecificLeg() {
    const legCopy = utils.cloneDeep(this.leg);
    return {
      mode: legCopy.mode,
      agencyId: legCopy.agencyId,
      from: legCopy.from,
      to: legCopy.to,
      startTime: legCopy.startTime,
      endTime: legCopy.endTime,
      // TODO In future we may need route id (see OTP schema) etc. for specific bookings
    };
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

  /**
   * Get Leg ID
   * @return {String}
   */
  get id() {
    return this.leg.id;
  }

  /**
   * Get Leg state
   * @return {String}
   */
  get state() {
    return this.leg.state;
  }

  /**
   * Get Leg start time
   * @return {String}
   */
  get startTime() {
    return this.leg.startTime;
  }

  /**
   * Get Leg end time
   * @return {String}
   */
  get endTime() {
    return this.leg.endTime;
  }

  /**
   * Get Booking of Let. Booking is given only if it has been resolved as Booking object
   */
  get booking() {
    if (this.leg.booking instanceof Booking) {
      return this.leg.booking;
    }
    return undefined;
  }

  /**
   * Get mode.
   */
  get mode() {
    return this.leg.mode;
  }
}

module.exports = Leg;
