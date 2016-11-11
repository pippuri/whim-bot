'use strict';

const Promise = require('bluebird');
const utils = require('../utils');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const stateMachine = require('../../lib/states/index').StateMachine;
const Booking = require('./Booking');
const awsUnitsSchema = require('maas-schemas/prebuilt/core/aws-units.json');
const bus = require('../../lib/service-bus');

// Milliseconds before leg start time when beeking
// should be done. Defaults to 30 minutes.
const ACTIVATION_TIME_BEFORE_START = {
  BUS: (15 * 60 * 1000),
  TRAM: (15 * 60 * 1000),
  TRAIN: (25 * 60 * 1000),
  TAXI: (10 * 60 * 1000),
  WALK: (5 * 60 * 1000),
  TRANSFER: (5 * 60 * 1000),
  WAIT: (5 * 60 * 1000),
  SUBWAY: (15 * 60 * 1000),
};

const LAMBDA_BOOKINGS_AGENCY_OPTIONS = 'MaaS-bookings-agency-options';

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

    // TODO: Consider adding identityId into leg schema instead of always inhering via constructor
    //
    // if (!this.leg.identityId) {
    //   this.leg.identityId = identityId;
    // }
    this.identityId = identityId;
  }

  /**
   * Creates and persists a new leg
   *
   * @static
   *
   * @param {Object} legInput The configuration object
   * @param {string} identityId as user's UUID
   * @param {boolean} [options.skipInsert] - Sst as true if the leg should NOT be inserted into database
   *
   * @return {Promise -> Leg}
   */
  static create(legInput, identityId, options) {
    options = options !== undefined ? options : {};
    const skipInsert = typeof options.skipInsert === 'undefined' ? false : options.skipInsert;

    if (typeof options !== 'object') {
      return Promise.reject(new Error('options need to be object'));
    }
    if (typeof skipInsert !== 'boolean') {
      return Promise.reject(new Error('skipInsert need to be true or false'));
    }

    return validator.validate(awsUnitsSchema.definitions.identityId, identityId)
      .then(_result => new Leg(legInput, identityId))
      .then(leg => {
        // check if this is bookable leg and we have supported for given agencyId
        if (leg._isBookableLeg()) {
          return Booking.isAgencyIdSupported(leg.leg.agencyId)
            .then(isSupported => {
              if (isSupported !== true) {
                console.warn(`[Leg] Warning! AgencyId '${leg.leg.agencyId}' not supported!`);
                return Promise.reject(new Error(`AgencyId '${leg.leg.agencyId}' not supported, cannot create itinerary`));
              }
              return Promise.resolve(leg);
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
   *
   * @param {object} [options.trx] - Objection transaction object. If given, all database operations here
   *   are bind to this transaction. Whoever calls this pay-method, must then commit or rollback the transaction!
   *
   * @return {Promise -> Leg}
   */
  pay(options) {
    options = options !== undefined ? options : {};
    const trx = options.trx;

    if (typeof options !== 'object') {
      return Promise.reject(new Error('options need to be object'));
    }

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
   *
   * @param {boolean} [options.tryReuseBooking] - If set true, leg activation tries to
   * find is user has already a ticket that cloud be (re)used also for this leg.
   * WARNING: searching a ticket is time consuming process, prefer using it *only* when
   * called e.g. from worker process
   *
   * @return {Promise -> Leg}
   */
  activate(options) {
    options = options !== undefined ? options : {};
    const tryReuseBooking = typeof options.tryReuseBooking === 'undefined' ? false : options.tryReuseBooking;

    if (typeof options !== 'object') {
      return Promise.reject(new Error('options need to be object'));
    }
    if (typeof tryReuseBooking !== 'boolean') {
      return Promise.reject(new Error('tryReuseBooking need to be true or false'));
    }
    if (tryReuseBooking === true && !this._isBookableLeg()) {
      console.warn('[Leg] Booking reuse requested, but not a bookable leg; ignoring..');
    }

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

    // helper for creating new booking
    const _createNewBooking = () => {
      const bookingInput = this._toBookingSpecificInput();
      // set starting time to be now (per leg activation)
      bookingInput.leg.startTime = Date.now();
      return Booking.create(bookingInput, this.identityId);
    };

    let bookingAction = Promise.resolve()
      .then(() => {
        console.info(`[Leg] Starting to activate leg '${this.leg.id}' within state '${this.leg.state}'...`);
        return Promise.resolve();
      });

    // acquire a booking if needed
    if (!this.leg.booking && this._isBookableLeg()) {
      bookingAction = bookingAction
        // try to reuse, if requested, or create new bookig
        .then(() => {
          if (tryReuseBooking === true) {
            return this._searchReusableBooking()
              .then(searchResult => {
                if (searchResult.booking) {
                  return Promise.resolve(searchResult.booking);
                }
                return _createNewBooking();
              });
          }
          return _createNewBooking();
        })
        // bind the re-used or newly created booking into this leg
        .then(booking => {
          this.leg.booking = booking;
          return models.Leg
            .query()
            .patch({ bookingId: this.leg.booking.id })
            .where('id', this.leg.id);
        })
        // make sure booking is paid and reserved
        .then(() => {
          // skip actual payment because paid already (leg is PAID)
          return this.leg.booking.pay({ skipPayment: true })
            .then(() => this.leg.booking.reserve());
        });
    }

    // activate
    return bookingAction
      .then(() => this._changeState('ACTIVATED'))
      .then(() => models.Leg
        .query()
        .patch({ state: this.leg.state })
        .where('id', this.leg.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error(`Leg ${this.leg.id} not found from database!`));
        }
        console.info(`[Leg] '${this.leg.id}' activated with with state '${this.leg.state}'`);
        return Promise.resolve(this);
      })
      .catch(err => {
        console.warn(`[Leg] Failed activating of '${this.leg.id}':`, err.message);
        return Promise.reject(new Error(`Failed to activate leg '${this.leg.id}':` + err.message));
      });
  }

  /**
   * Cancels the leg. If Leg is "active", cancel operation is tried and result
   * is successful either with new state of CANCELLED or CANCELLED_WITH_ERRORS. If Leg is already
   * cancelled, or finished already, the cancel operation will fails as illegal state transtion.
   *
   * @return {Promise -> Leg}
   */
  cancel() {
    console.info(`[Leg] Starting to cancel leg '${this.leg.id}' with state '${this.leg.state}'...`);

    if (!this._isValidStateChange('CANCELLED') && !this._isValidStateChange('CANCELLED_WITH_ERRORS')) {
      return Promise.reject(new MaaSError(`This leg cannot be cancelled because it is '${this.leg.state}'`, 400));
    }

    const bookingCancel = (this.leg.booking) ? this.leg.booking.cancel({ skipRefund: true }) : Promise.resolve();
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
   *
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

  //
  // Helpers to figure out leg information
  //

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
   * @private
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
   *
   * @private
   *
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
  * @private
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
   * Return booking specific subset of leg information
   *
   * @private
   *
   * @return {Object} leg input for booking
   */
  _toBookingSpecificInput() {
    const legCopy = utils.cloneDeep(this.leg);
    return {
      leg: {
        mode: legCopy.mode,
        agencyId: legCopy.agencyId,
        from: legCopy.from,
        to: legCopy.to,
        startTime: legCopy.startTime,
        endTime: legCopy.endTime,
        // TODO In future we may need route id (see OTP schema) etc. for specific bookings
      },
      fare: legCopy.fare,
    };
  }

  /**
   * Searches if the owner of this leg has bookings that match to the need of this leg.
   * NOTE! Search may be time consuming, so use with care.. :)
   *
   * @private
   *
   * @return {Promise -> Object} Search results. if found, object has 'booking' field with
   * the found Booking business object.
   */
  _searchReusableBooking() {

    const optionsQuery = {
      identityId: this.identityId,
      agencyId: this.leg.agencyId,
      mode: this.leg.mode,
      from: `${this.leg.from.lat},${this.leg.from.lon}`,
      to: `${this.leg.to.lat},${this.leg.to.lon}`,
      startTime: this.leg.startTime.toString(),
      endTime: this.leg.endTime.toString(),
    };

    console.info(`[Leg] Searching reusable tickets for user ${this.identityId} for leg ${this.leg.id}...`);

    return Promise.all([
      // TODO: Improve booking query to accept e.g. validity time as search parameter
      Booking.query(this.identityId, undefined, undefined, ['CONFIRMED', 'RESERVED', 'ACTIVATED']),
      bus.call(LAMBDA_BOOKINGS_AGENCY_OPTIONS, optionsQuery),
    ])
      .spread((allBookings, optionsResult) => {
        // filter bookings that match validity wise
        let suitableBooking;
        for (let i = 0; i < allBookings.length; ++i) {
          const booking = allBookings[i];

          // agencyId need to match
//console.log('booking.leg.agencyId', booking.leg.agencyId);
//console.log('this.leg.agencyId', this.leg.agencyId);
          if (booking.leg.agencyId !== this.leg.agencyId) {
            continue;
          }

          // booking validity need to last 20 min past this leg start (safety margin)
          const bookingTerms = booking.terms;
//console.log('bookingTerms', bookingTerms);
          const validUntil = bookingTerms &&
                             bookingTerms.validity &&
                             bookingTerms.validity.endTime;
//console.log('validUntil', validUntil);
//console.log('this.leg.startTime', this.leg.startTime);
          if (!validUntil) {
            continue;
          }
          if (validUntil + (20 * 60 * 1000) > this.leg.startTime) {
            continue;
          }

          // check does booking type match with required
          const optionMatch = optionsResult.options.some(option => {
            const optionTerms = option.terms;
//console.log('optionTerms.type', optionTerms.type);
//console.log('bookingTerms.type', bookingTerms.type);

            return optionTerms.type === bookingTerms.type;
          });
          if (optionMatch) {
            suitableBooking = booking;
            break;
          }
        }

        if (suitableBooking) {
          console.info(`[Leg] Found reusable booking ${suitableBooking.id} for leg ${this.leg.id}`);
          return Promise.resolve({ booking: suitableBooking });
        }
        console.info(`[Leg] No reusable booking found for leg ${this.leg.id}`);
        return Promise.resolve({});

      })
      .catch(err => {
        console.warn('[Leg] Errors while searching bookigns for reuse, ignoring...', err);
        return Promise.resolve({});
      });

  }

  /**
   * Get Leg ID
   *
   * @return {String}
   */
  get id() {
    return this.leg.id;
  }

  /**
   * Get Leg state
   *
   * @return {String}
   */
  get state() {
    return this.leg.state;
  }

  /**
   * Get Leg start time
   *
   * @return {String}
   */
  get startTime() {
    return this.leg.startTime;
  }

  /**
   * Get Leg end time
   *
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
