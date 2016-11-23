'use strict';

const awsUnitsSchema = require('maas-schemas/prebuilt/core/aws-units.json');
const Leg = require('./Leg');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Profile = require('./Profile');
const Promise = require('bluebird');
const stateMachine = require('../../lib/states/index').StateMachine;
const Transaction = require('../../lib/business-objects/Transaction');
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
   *
   * @param {object} bookingInput The configuration object
   * @param {string} identityId as user's UUID
   * @param {object} transaction - Objection transaction object. If given, all database operations here
   *   are bind to this transaction. Whoever calls this create-method, must then commit or rollback the transaction!
   *   The transaction must be created with Itinerary.startTransaction() by caller.
   *
   * @return {Promise -> Itinerary}
   */
  static create(itineraryInput, identityId, transaction) {

    if (!transaction) {
      return Promise.reject(new Error('A started transaction is required for Itinerary creation'));
    }

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
          // but skip insert legs into DB, as we call insertWithRelated() here later.
          return Leg.create(legInput, identityId, transaction, { skipInsert: true });
        })
          .then(legs => {
            itinerary.itinerary.legs = legs;
            return Promise.resolve(itinerary);
          });
      })
      .then(itinerary => itinerary._changeState('PLANNED'))
      .then(itinerary => {
        return models.Itinerary.bindTransaction(transaction)
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
   *
   * @static
   *
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
        itinerary.itinerary.legs = itinerary.itinerary.legs.map(legData => new Leg(legData.toJSON(), itinerary.identityId));
        return Promise.resolve(itinerary);
      });
  }

  /**
   * Makes a query with given parameters
   *
   * @static
   *
   * @param {string} identityId
   * @param {string} startTime
   * @param {string} endTime
   * @param {array} states
   *
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
   * Cancels the Itinerary. If the itinerary is already cancelled, the cancellation will be automatically succesful.
   * If the itinerary is "active", cancel operation is tried and result is always successful either with a
   * state of CANCELLED or CANCELLED_WITH_ERRORS. If itinerary is not active (e.g. FINISHED), cancellation fails and
   * the state is kept as it was.
   *
   * @param {object} transaction - Objection transaction object. If given, all database operations here
   *   are bind to this transaction. Whoever calls this create-method, must then commit or rollback the transaction!
   *   The transaction must be created with Itinerary.startTransaction() by caller.
   * @return {Promise -> Itinerary}
   */
  cancel(transaction) {
    console.info(`[Itinerary] Starting to cancel itinerary '${this.itinerary.id}' with state '${this.itinerary.state}'...`);

    if (['CANCELLED', 'CANCELLED_WITH_ERRORS'].indexOf(this.state) !== -1) {
      console.warn(`[Itinerary] Warning, re-cancellation of itinerary ${this.itinerary.id} requested, ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('CANCELLED') && !this._isValidStateChange('CANCELLED_WITH_ERRORS')) {
      return Promise.reject(new MaaSError(`This itinerary cannot be cancelled because it is '${this.itinerary.state}'`, 400));
    }

    // Calculate refund. Refund = paid itinerary fare - fare(s) of non-cancellable booking(s)
    let paidFare = this.itinerary.fare && this.itinerary.fare.points;
    if (!paidFare) paidFare = 0;
    const refund = this.itinerary.legs.reduce((i, leg) => {
      let usedFare = 0;
      if (leg.booking && !leg.booking.isRefundable()) {
        usedFare = leg.booking.fareInPoints() || 0;
      }
      return i - usedFare;
    }, paidFare);

    // If called from Helvetinkone, there wont be an input transaction, therefore create a new one
    let trx = transaction;
    let newTransaction = false;
    if (!trx) {
      trx = new Transaction(this.itinerary.identityId);
      newTransaction = true;
    }

    let legCancelFails = false;
    let oldBalance;
    let action;

    if (newTransaction) {
      action = trx.start()
        .then(() => trx.bind(models.Itinerary))
        .then(() => trx.associate(models.Itinerary, this.itinerary.id));
    } else {
      action = Promise.resolve();
    }

    return action
      // try to cancel legs & itinerary
      .then(() => {
        const legCancels = this.itinerary.legs.map(leg => {
          // NOTE! We are not binding leg (or booking) cancellations
          // into transaction, as we cannot control TSP actions as transactionals.
          return leg.cancel(trx).reflect();
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
        // by an academic interest, check if actual cancellation would have resulted different refund
        // than the "agreement with user" ie pre-calculated refund
        const actualRefund = this.itinerary.legs.reduce((i, leg) => {
          let usedFare = 0;
          if (leg.state === 'CANCELLED_WITH_ERRORS' && leg.booking) {
            usedFare = leg.booking.fareInPoints() || 0;
          }
          return i - usedFare;
        }, paidFare);
        if (actualRefund !== refund) {
          console.warn(`[Itinerary] WARNING: Actual refund of ${actualRefund} differs from the refund of ${refund} given to user`);
        }
        if (refund === 0) {
          console.info(`[Itinerary] Refunding 0 points out of paid ${paidFare} points`);
          return Promise.resolve();
        }
        console.info(`[Itinerary] Refunding ${refund} points out of paid ${paidFare} points`);
        return Profile.retrieve(this.itinerary.identityId)
          .then(profile => {
            oldBalance = profile.balance;
            const newBalance = oldBalance + refund;
            return Profile.update(this.itinerary.identityId, { balance: newBalance }, transaction);
          });
      })
      // persist
      .then(() => {
        return models.Itinerary.bindTransaction(trx)
          .query()
          .patch({ state: this.itinerary.state })
          .where('id', this.itinerary.id);
      })
      .then(updateCount => {
        if (updateCount === 0) {
          return Promise.reject(new Error('Not found from database'));
        }

        console.info(`[Itinerary] Cancellation of '${this.itinerary.id}' resulted state '${this.itinerary.state}'`);

        // If transaction is not an input and is new, commit it here
        // If not, it should be commited by the caller of the function
        if (newTransaction) {
          const firstLeg = this.itinerary.legs[0].leg;
          const lastLeg = this.itinerary.legs[this.itinerary.legs.length - 1].leg;

          const fromName = firstLeg.from.name ? firstLeg.from.name : `${firstLeg.from.lat},${firstLeg.from.lon}`;
          const toName = lastLeg.to.name ? lastLeg.to.name : `${lastLeg.to.lat},${lastLeg.to.lon}`;

          const message = `Trip from ${fromName} to ${toName} cancelled and refunded`;
          return transaction.commit(refund, message)
            .then(() => Promise.resolve(this));
        }

        return Promise.resolve(this);
      })
      // handle errors
      .catch(err => {
        console.warn('[Itinerary] failed cancel itinerary, err:', err.stack || err);
        return transaction.rollback()
          .finally(() => Promise.reject(new Error(`Itinerary ${this.itinerary.id} cancel failed: ` + err)));
      });
  }

  /**
   * Validates if itinerary is owned by given user.
   *
   * @param {string} identityId as user's UUID
   *
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
   * @param {object} transaction - Objection transaction object. If given, all database operations here
   *   are bind to this transaction. Whoever calls this pay-method, must then commit or rollback the transaction!
   *   The transaction can be created with Itinerary.startTransaction() by caller.
   *
   * @return {Promise -> Itinerary}
   */
  pay(transaction) {

    if (!transaction) {
      return Promise.reject(new Error('A started transaction is required for booking payment'));
    }

    if (this.state === 'PAID') {
      console.warn(`[Itinerary] Warning, re-payment of itinerary ${this.itinerary.id} requested in state '${this.state}', ignoring`);
      return Promise.resolve(this);
    }

    if (!this._isValidStateChange('PAID')) {
      return Promise.reject(new MaaSError(`This itinerary cannot be paid because it is '${this.itinerary.state}'`, 400));
    }

    let fare = this.itinerary.fare && this.itinerary.fare.points;
    if (!fare) fare = 0;

    console.info(`[Itinerary] Starting payment of '${this.itinerary.id}' of fare ${fare}...`);

    return Profile.retrieve(this.itinerary.identityId)
      .then(profile => {
        if (fare === 0) {
          console.info('[Itinerary] Zero cost itinerary, paying per booking...');
          return Promise.resolve();
        }
        const newBalance = profile.balance - fare;

        return Profile.update(this.itinerary.identityId, { balance: newBalance }, transaction);
      })
      .then(() => this._changeState('PAID'))
      .then(() => {
        const legsPayments = this.itinerary.legs.map(leg => {
          return leg.pay(transaction);
        });
        return Promise.all(legsPayments);
      })
      .then(() => {
        return models.Itinerary.bindTransaction(transaction)
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
   *
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
   *
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

  /**
   * Returns itinerary as immutable Javascript object
   *
   * @return {object} itinerary
   */
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
   * @private
   *
   * @param {string} new state
   *
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
   *
   * @private
   *
   * @param {string} new state
   *
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
   *
   * @return {string}
   */
  get id() {
    return this.itinerary.id;
  }

  /**
   * Get legs. Legs are given only if those has been resolved as Leg objects
   *
   * @return {Array[Leg]}
   */
  get legs() {
    if (this.itinerary.legs[0] instanceof Leg) {
      return this.itinerary.legs;
    }
    return [];
  }

  /**
   * Get Itinerary state
   *
   * @return {string}
   */
  get state() {
    return this.itinerary.state;
  }

  /**
   * Get Itinerary owner
   *
   * @return {string}
   */
  get identityId() {
    return this.itinerary.identityId;
  }

  /**
   * Get Itinerary start time
   *
   * @return {string}
   */
  get startTime() {
    return this.itinerary.startTime;
  }

  /**
   * Get Itinerary end time
   *
   * @return {string}
   */
  get endTime() {
    return this.itinerary.endTime;
  }


}

module.exports = Itinerary;
