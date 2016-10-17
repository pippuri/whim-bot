'use strict';

const awsUnitsSchema = require('maas-schemas/prebuilt/core/aws-units.json');
const Leg = require('./Leg');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const objection = require('objection');
const Profile = require('./Profile');
const Promise = require('bluebird');
const stateMachine = require('../../lib/states/index').StateMachine;
const unitsSchema = require('maas-schemas/prebuilt/core/units.json');
const utils = require('../utils');
const validator = require('../../lib/validator');

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
   *
   * @static
   * @param {object} bookingInput The configuration object
   * @param {string} identityId as user's UUID
   * @param {object} [trx] Objection transaction object. If given, all database operations here
   *                       are bind to this transaction. Whoever calls this create-method,
   *                       must then commit or rollback the transaction! The transaction must be
   *                       created with Itinerary.startTransaction() by caller.
   * @return {Promise -> Itinerary}
   */
  static create(itineraryInput, identityId, trx) {
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
          // NOTE: Not binding leg creation into the transaction,
          // but give "true" to not to insert legs into DB, as we
          // call insertWithRelated() here later.
          return Leg.create(legInput, identityId, true);
        })
          .then(legs => {
            itinerary.itinerary.legs = legs;
            return Promise.resolve(itinerary);
          });
      })
      .then(itinerary => itinerary._changeState('PLANNED'))
      .then(itinerary => {
        let model = models.Itinerary;
        model = trx ? model.bindTransaction(trx) : model;
        return model
          .query()
          .insertWithRelated(itinerary.toObject())
          .then(() => {
            console.info(`[Itinerary] Created '${itinerary.itinerary.id}' with ${itinerary.itinerary.legs.length} leg(s).`);
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
   *
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
   * Creates an transaction object for Itinerary. This transaction object
   * can be given e.g. to Itinerary.create() to bind the create into a transaction
   * chain. Caller must then take care to call either commit() or rollback() to
   * close the transaction.
   *
   * @static
   * @return {Promise -> Objection transaction object}
   */
  static startTransaction() {
    return objection.transaction.start(models.Itinerary);
  }

  /**
   * Performs a reservation for a signle leg
   * @param {string} legId
   * @return {Promise -> Itinerary}
   */
  reserveLeg(legId) {

    // check allowed states
    if (this.itinerary.state !== 'PAID' && this.itinerary.state !== 'ACTIVATED') {
      return Promise.reject(new MaaSError(`This itinerary cannot process leg reservations because it is '${this.itinerary.state}'`, 400));
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
        console.warn(`[Itinerary] Failed to reserve of leg '${legId}' in '${this.itinerary.id}':`, err);
        return Promise.reject(new Error(`Failed to reserve  of leg '${legId}' in '${this.itinerary.id}':`, err));
      });

  }

  /**
   * Cancels the Itinerary. If the itinerary is already cancelled, the cancellation will be automatically succesful.
   * If the itinerary is "active", cancel operation is tried and result is always successful either with a
   * state of CANCELLED or CANCELLED_WITH_ERRORS. If itinerary is not active (e.g. FINISHED), cancellation fails and
   * the state is kept as it was.
   *
   * @return {Promise -> Itinerary}
   */
  cancel() {
    console.info(`[Itinerary] Starting to cancel itinerary '${this.itinerary.id}' with state '${this.itinerary.state}'...`);

    if (['CANCELLED', 'CANCELLED_WITH_ERRORS'].indexOf(this.state) !== -1) {
      console.warn(`[Itinerary] Warning, re-cancellation of itinerary ${this.itinerary.id} requested, ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('CANCELLED') && !this._isValidStateChange('CANCELLED_WITH_ERRORS')) {
      return Promise.reject(new MaaSError(`This itinerary cannot be cancelled because it is '${this.itinerary.state}'`, 400));
    }

    let fare = this.itinerary.fare && this.itinerary.fare.points;
    if (!fare) fare = 0;
    let trx;
    let legCancelFails = false;
    let oldBalance;

    return objection.transaction.start(models.Itinerary)
      // open transaction
      .then(transaction => {
        trx = transaction;
        return Promise.resolve();
      })
      // try to cancel legs & itinerary
      .then(() => {
        const legCancels = this.itinerary.legs.map(leg => {
          // NOTE! We are not binding leg (or booking) cancellations
          // into transaction, as we cannot control TSP actions as transactionals.
          return leg.cancel().reflect();
        });
        return Promise.all(legCancels)
          .each(inspection => {
            if (!inspection.isFulfilled()) {
              console.warn('[Itinerary] Failed to cancel a leg: ', inspection.reason());
              legCancelFails = true;
            }
          })
          .then(() => {
            if (legCancelFails === true) {
              return this._changeState('CANCELLED_WITH_ERRORS');
            }
            return this._changeState('CANCELLED');
          });
      })
      // refund if needed
      .then(() => {
        if (fare === 0) {
          console.info('[Itinerary] Zero cost itinerary, no refunding');
          return Promise.resolve();
        }
        if (this.state === 'CANCELLED') {
          console.info(`[Itinerary] Trying to refund fare ${fare} points..`);
          return Profile.retrieve(this.itinerary.identityId)
            .then(profile => {
              oldBalance = profile.balance;
              const newBalance = oldBalance + fare;
              return Profile.update(this.itinerary.identityId, { balance: newBalance }, trx);
            });
        }
        console.info(`[Itinerary] Fare of ${fare} points NOT refunded as not clean cancel`);
        return Promise.resolve();
      })
      // persist
      .then(() => {
        let model = models.Itinerary;
        model = trx ? model.bindTransaction(trx) : model;
        return model
          .query()
          .patch({ state: this.itinerary.state })
          .where('id', this.itinerary.id);
      })
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Itinerary] Cancellation of '${this.itinerary.id}' resulted state '${this.itinerary.state}'`);
        return trx.commit()
          .then(() => Promise.resolve(this));
      })
      // handle errors
      .catch(err => {
        console.warn('[Itinerary] failed cancel itinerary, err:', err.stack || err);
        const rollback = trx ? trx.rollback() : Promise.resolve();
        return rollback
          .finally(() => Promise.reject(new Error(`Itinerary ${this.itinerary.id} cancel failed: ` + err)));
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
   * Pay itinerary. Please note that is payment is done *without* transaction, funds are not returned
   * to user in case of any error.
   *
   * @param {object} [trx] Objection transaction object. If given, all database operations here
   *                       are bind to this transactions. Whoever calls this pay-method,
   *                       must then commit or rollback the transaction! The transaction must be
   *                       created with Itinerary.startTransaction() by caller.
   * @return {Promise -> Itinerary}
   */
  pay(trx) {
    console.info(`[Itinerary] Starting payment of '${this.itinerary.id}'...`);

    if (this.state === 'PAID') {
      console.warn(`[Itinerary] Warning, re-payment of itinerary ${this.itinerary.id} requested in state '${this.state}', ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('PAID')) {
      return Promise.reject(new MaaSError(`This itinerary cannot be paid because it is '${this.itinerary.state}'`, 400));
    }

    let fare = this.itinerary.fare && this.itinerary.fare.points;
    if (!fare) fare = 0;

    return Profile.retrieve(this.itinerary.identityId)
      .then(profile => {
        if (fare === 0) {
          console.info('[Itinerary] Zero cost itinerary, paying per booking...');
          return Promise.resolve();
        }
        const newBalance = profile.balance - fare;
        return Profile.update(this.itinerary.identityId, { balance: newBalance }, trx);
      })
      .then(() => this._changeState('PAID'))
      .then(() => {
        const legsPayments = this.itinerary.legs.map(leg => {
          return leg.pay(trx);
        });
        return Promise.all(legsPayments);
      })
      .then(() => {
        let model = models.Itinerary;
        model = trx ? model.bindTransaction(trx) : model;
        return model
          .query()
          .patch({ state: this.itinerary.state })
          .where('id', this.itinerary.id);
      })
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Itinerary] Successful payment of '${this.itinerary.id}', fare ${fare} points`);
        return Promise.resolve(this);
      })
      .catch(err => {
        console.warn('[Itinerary] failed to pay, err', err);
        return Promise.reject(new Error(`Itinerary ${this.itinerary.id} pay failed: ` + err));
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
      return Promise.reject(new MaaSError(`This itinerary cannot be activated because it is '${this.itinerary.state}'`, 400));
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

  /**
   * Finish itinerary
   * @return {Promise -> Itinerary}
   */
  finish() {
    console.info(`[Itinerary] Starting to finish itinerary '${this.itinerary.id}' with state '${this.itinerary.state}'...`);

    if (['CANCELLED', 'CANCELLED_WITH_ERRORS', 'FINISHED'].indexOf(this.state) !== -1) {
      console.warn(`[Itinerary] Warning, re-finishing of itinerary ${this.itinerary.id} requested, ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('FINISHED')) {
      return Promise.reject(new MaaSError(`This itinerary cannot be finished because it is '${this.itinerary.state}'`, 400));
    }

    // try to finish legs
    const legFinishs = this.itinerary.legs.map(leg => {
      return leg.finish().reflect();
    });

    return Promise.all(legFinishs)
      .each(inspection => {
        if (!inspection.isFulfilled()) {
          console.warn('[Itinerary] Failed to finish a leg, ignoring: ', inspection.reason());
        }
      })
      .then(() => this._changeState('FINISHED'))
      .then(() => models.Itinerary
        .query()
        .patch({ state: this.itinerary.state })
        .where('id', this.itinerary.id))
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }
        console.info(`[Itinerary] Finishing of '${this.itinerary.id}' resulted state '${this.itinerary.state}'`);
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
