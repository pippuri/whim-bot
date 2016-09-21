'use strict';

const Promise = require('bluebird');
const utils = require('../utils');
const Leg = require('./Leg');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const models = require('../../lib/models');
const stateMachine = require('../../lib/states/index').StateMachine;
const maasOperation = require('../../lib/maas-operation');
const objection = require('objection');
const awsUnitsSchema = require('maas-schemas/prebuilt/core/aws-units.json');
const unitsSchema = require('maas-schemas/prebuilt/core/units.json');

/**
 * An encapsulation of Itinerary that handles the operations
 * to create, retrieve, list and cancel the itinerary.
 */
class Itinerary {

  /**
   * A factory method that constructs the itinerary from a DAO
   *
   * @param {object} booking a raw booking object (e.g. JSON object)
   */
  constructor(itineraryInput, identityId) {
    // Assign the data object with a frozen copy
    this.itinerary = utils.cloneDeep(itineraryInput);

    // validation of mandatory data
    if (identityId && this.itinerary.identityId) {
      throw new MaaSError('Cannot reassign owner of the itinerary when initialized', 400);
    }
    if (!identityId && !this.itinerary.identityId) {
      throw new MaaSError('Itinerary cannot be initialized without owner', 400);
    }
    if (!Array.isArray(this.itinerary.legs) || this.itinerary.legs.length === 0) {
      throw new MaaSError('Itinerary cannot be initialized without leg(s)', 400);
    }

    // assign mandatory proporties if missing
    if (!this.itinerary.state) {
      this.itinerary.state = 'START';
    }
    if (!this.itinerary.id) {
      this.itinerary.id = utils.createId();
    }
    if (!this.itinerary.identityId) {
      this.itinerary.identityId = identityId;
    }
  }

  /**
   * Creates and persists a new itinerary
   * @static
   * @param {object} bookingInput The configuration object
   * @param {string} identityId as user's UUID
   * @return {Promise -> Itinerary}
   */
  static create(itineraryInput, identityId) {
    return validator.validate(awsUnitsSchema.definitions.identityId, identityId)
      .then(_result => new Itinerary(itineraryInput, identityId))
      .then(itinerary => {
        itinerary.itinerary.legs = itinerary.itinerary.legs.map(leg => {
          // HACK: to guarantee leg order we insert IDs already here, because
          // we don't know in which order Legs are constructed in promise chain.
          leg.id = utils.createId();
          return leg;
        });
        return Promise.map(itinerary.itinerary.legs, legInput => {
          return Leg.create(legInput, identityId, true);
        })
          .then(legs => {
            itinerary.itinerary.legs = legs;
            return Promise.resolve(itinerary);
          });
      })
      .then(itinerary => itinerary._changeState('PLANNED'))
      .then(itinerary => {
        return models.Itinerary
          .query()
          .insertWithRelated(itinerary.toObject())
          .then(() => {
            console.info(`[Itinerary] Created and saved '${itinerary.itinerary.id}' with ${itinerary.itinerary.legs.length} leg(s).`);
            return Promise.resolve(itinerary);
          });
      });
  }

  /**
   * Fetch an itinerary
   * @static
   * @param {string} itineraryId
   * @return {Promise -> Itinerary}
   */
  static retrieve(itineraryId) {
    return validator.validate(unitsSchema.definitions.uuid, itineraryId)
      .then(_result => models.Itinerary.query()
        .findById(itineraryId)
        .eager('[legs, legs.booking]')
        .filterEager('legs', builder => {
          // Order leg by their ids
          builder.orderBy('id');
        }))
      .then(itineraryData => {
        // Handle not found
        if (typeof itineraryData === typeof undefined) {
          return Promise.reject(new MaaSError(`No item found with itineraryId ${itineraryId}`, 404));
        }
        return Promise.resolve(new Itinerary(itineraryData));
      })
      .then(itinerary => {
        itinerary.itinerary.legs = itinerary.itinerary.legs.map(legData => new Leg(legData.toJSON()));
        return Promise.resolve(itinerary);
      });
  }

  /**
   * Makes a query with given parameters
   * @static
   * @param {string} identityId
   * @param {string} startTime
   * @param {string} endTime
   * @param {array} states
   * @return {Promise -> Array[Itinerary]}
   */
  static query(identityId, startTime, endTime, states) {
    let query = models.Itinerary.query()
      .where('identityId', identityId);

    if (startTime !== null) {
      query = query.andWhere('startTime', '>=', (new Date(startTime)).toISOString());
    }

    if (endTime !== null) {
      query = query.andWhere('endTime', '<=', (new Date(endTime)).toISOString());
    }

    if (states.length > 0) {
      query = query.whereIn('state', states);
    }

    return query
      .eager('[legs, legs.booking]')
      .filterEager('legs', builder => {
        // Order leg by their ids
        builder.orderBy('id');
      })
      .orderBy('startTime')
      .then(results => Promise.resolve(results.map(itineraryData => {
        return new Itinerary(itineraryData.toJSON());
      })));
  }

  /**
   * Performs a reservation for a signle leg
   * @param {string} legId
   * @return {Promise -> Itinerary}
   */
  reserveLeg(legId) {

    // check allowed states
    if (this.itinerary.state !== 'PAID' && this.itinerary.state !== 'ACTIVATED') {
      return Promise.reject(new MaaSError(`This itinerary cannot process leg reservations because now '${this.itinerary.state}'`, 400));
    }

    // get leg
    const leg = this.itinerary.legs.find(leg => leg.id === legId);
    if (!leg) {
      return Promise.reject(new MaaSError(`Not leg '${legId}' found in itinerary '${this.itinerary.state}'`, 404));
    }
    return leg.reserve()
      .catch(err => {
        // TODO: set itinerary e.g. into 'ACTIVATED_WITH_ERRORS'?
        console.leg('[Itinerary] Leg reservation failed but not cancelling itinerary...');
        return Promise.resolve();
      })
      .then(() => this._changeState('ACTIVATED'))
      .then(() => models.Itinerary
        .query()
        .patch({ state: this.itinerary.state })
        .where('id', this.itinerary.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Itinerary] Leg reserve within '${this.itinerary.id}' resulted state '${this.itinerary.state}'`);
        return Promise.resolve(this);
      })
      .catch(err => {
        console.error(`[Itinerary] Failed to reserve of leg '${legId}' in '${this.itinerary.id}':`, err);
        return Promise.reject(new Error(`Failed to reserve  of leg '${legId}' in '${this.itinerary.id}':`, err));
      });

  }

  /**
   * Cancels the Itinerary. If the itinerary is already in a state that can be consider ended
   * in a way or another, the cancellation will be succesful. If the itinerary is "active",
   * cancel operation is tried and result is either state of CANCELLED or CANCELLED_WITH_ERRORS.
   * @return {Promise -> Itinerary}
   */
  cancel() {
    if (['CANCELLED', 'CANCELLED_WITH_ERRORS', 'FINISHED'].indexOf(this.state) !== -1) {
      console.warn(`[Itinerary] Warning, re-cancellation of itinerary ${this.itinerary.id} requested in state '${this.state}', ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('CANCELLED') && !this._isValidStateChange('CANCELLED_WITH_ERRORS')) {
      return Promise.reject(new MaaSError(`This itinerary cannot be cancelled because now '${this.itinerary.state}'`, 400));
    }
    console.info(`[Itinerary] Starting to cancel itinerary '${this.itinerary.id}' with state '${this.itinerary.state}'...`);

    // try to cancel legs
    let legCancelFails = false;

    const legCancels = this.itinerary.legs.map(leg => {
      return leg.cancel().reflect();
    });

    return Promise.all(legCancels)
      .each(inspection => {
        if (!inspection.isFulfilled()) {
          console.error('[Itinerary] Failed to cancel a leg: ', inspection.reason());
          legCancelFails = true;
        }
      })
      .then(() => {
        if (legCancelFails === true) {
          return this._changeState('CANCELLED_WITH_ERRORS');
        }
        return this._changeState('CANCELLED');
      })
      .then(() => models.Itinerary
        .query()
        .patch({ state: this.itinerary.state })
        .where('id', this.itinerary.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Itinerary] Cancellation of '${this.itinerary.id}' resulted state '${this.itinerary.state}'`);
        return Promise.resolve(this);
      });
  }

  /**
   * Validates if itinerary is owned by given user.
   * @param {string} identityId as user's UUID
   * @return {Promise -> Itinerary}
   */
  validateOwnership(identityId) {
    return validator.validate(awsUnitsSchema.definitions.identityId, identityId)
      .then(_result => {
        if (this.itinerary.identityId !== identityId) {
          return Promise.reject(new MaaSError(`Itinerary ${this.itinerary.id} not owned by the user`, 403));
        }
        return Promise.resolve(this);
      });
  }

  /**
   * Pay itinerary
   * @return {Promise -> Itinerary}
   */
  pay() {
    if (this.state === 'PAID') {
      console.warn(`[Itinerary] Warning, re-payment of itinerary ${this.itinerary.id} requested in state '${this.state}', ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('PAID')) {
      return Promise.reject(new MaaSError(`This itinerary cannot be paid because now '${this.itinerary.state}'`, 400));
    }

    console.info(`[Itinerary] Starting payment of '${this.itinerary.id}'...`);

    let fare = this.itinerary.fare && this.itinerary.fare.points;
    if (!fare) fare = 0;
    let trx;
    let oldBalance;
    let paid = false;

    return maasOperation.fetchCustomerProfile(this.itinerary.identityId) // Get customer information
      .then(profile => {
        if (fare === 0) {
          console.info('[Itinerary] Zero cost itinerary, paying per booking...');
          return Promise.resolve();
        }
        oldBalance = profile.balance;
        return maasOperation.computeBalance(fare, profile)
          .then(newBalance => maasOperation.updateBalance(this.itinerary.identityId, newBalance))
          .then(() => {
            paid = true;
            return Promise.resolve();
          });
      })
      .then(() => this._changeState('PAID'))
      .then(() => objection.transaction.start(models.Itinerary))
      .then(transaction => {
        trx = transaction;
        const legsPayments = this.itinerary.legs.map(leg => {
          return leg.pay(trx);
        });
        return Promise.all(legsPayments);
      })
      .then(() => models.Itinerary
        .bindTransaction(trx)
        .query()
        .patch({ state: this.itinerary.state })
        .where('id', this.itinerary.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        return trx.commit()
          .then(() => {
            console.info(`[Itinerary] Successful payment of '${this.itinerary.id}', fare ${fare} points`);
            return Promise.resolve(this);
          });
      })
      .catch(err => {
        console.error('[Itinerary] failed to pay, err', err);
        let rollback;
        if (trx) {
          rollback = trx.rollback();
        } else {
          rollback = Promise.resolve();
        }
        return rollback
          .then(() => {
            if (paid === true && oldBalance) {
              console.warn(`[Itinerary] Restoring original ${oldBalance} points for customer...`);
              return maasOperation.updateBalance(this.itinerary.identityId, oldBalance);
            }
            return Promise.resolve();
          })
          // After failed payment we drive itinerary to be CANCELLED. Most propably it ends
          // into CANCEL_WITH_ERRORS. Later we UI supports journey we, we can stay in PAID
          // and let user to retry instead.
          .then(() => this.cancel())
          .finally(() => Promise.reject(new Error(`Itinerary ${this.itinerary.id} pay failed: ` + err)));
      });
  }

  /**
   * Activate itinerary
   * @return {Promise -> Itinerary}
   */
  activate() {
    if (this.state === 'ACTIVATED') {
      console.warn(`[Itinerary] Warning, re-activation of itinerary ${this.itinerary.id} requested in state '${this.state}', ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('ACTIVATED')) {
      return Promise.reject(new MaaSError(`This itinerary cannot be activated because now '${this.itinerary.state}'`, 400));
    }

    console.info(`[Itinerary] Activating '${this.itinerary.id}'...`);

    return this._changeState('ACTIVATED')
      .then(() => models.Itinerary
        .query()
        .patch({ state: this.itinerary.state })
        .where('id', this.itinerary.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Itinerary] Activated '${this.itinerary.id}'`);
        return Promise.resolve(this);
      });
  }


  toJSON() {
    return utils.cloneDeep(this.itinerary);
  }

  /**
   * Returns itinerary as immutable Javascript object
   *
   * @return {object} itinerary
   */
  toObject() {
    return JSON.parse(JSON.stringify(this.itinerary));
  }

  /**
   * Validates the state change
   *
   * @param {string} new state
   * @return {boolean} true if state change valid, false otherwise
   */
  _isValidStateChange(state) {
    let result = false;
    if (stateMachine.isStateValid('Itinerary', this.itinerary.state, state)) {
      result = true;
    }
    return result;
  }

  /**
   * Change itinerary state and log the state change
   * @param {string} new state
   * @return {Promise -> Itinerary}
   */
  _changeState(state) {
    const old_state = this.itinerary.state;
    this.itinerary.state = state;
    return stateMachine.changeState('Itinerary', this.itinerary.id, old_state, this.itinerary.state)
      .then(() => this);
  }

  /**
   * Get Itinerary ID
   * @return {String}
   */
  get id() {
    return this.itinerary.id;
  }

  /**
   * Get legs. Legs are given only if those has been resolved as Leg objects
   */
  get legs() {
    if (this.itinerary.legs[0] instanceof Leg) {
      return this.itinerary.legs;
    }
    return [];
  }

  /**
   * Get Itinerary state
   * @return {String}
   */
  get state() {
    return this.itinerary.state;
  }

  /**
   * Get Itinerary owner
   * @return {String}
   */
  get identityId() {
    return this.itinerary.identityId;
  }

  /**
   * Get Itinerary start time
   * @return {String}
   */
  get startTime() {
    return this.itinerary.startTime;
  }

  /**
   * Get Itinerary end time
   * @return {String}
   */
  get endTime() {
    return this.itinerary.endTime;
  }


}

module.exports = Itinerary;
