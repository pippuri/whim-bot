'use strict';

const Promise = require('bluebird');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const Trip = require('../../lib/trip/Trip');
const Decision = require('../../lib/trip/Decision');
const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError.js');
const AWS = require('aws-sdk');
const Itinerary = require('../../lib/business-objects/Itinerary');
const models = require('../../lib/models');
const Transaction = require('../../lib/business-objects/Transaction');

const swfClient = new AWS.SWF({ region: process.env.AWS_REGION });
Promise.promisifyAll(swfClient);

const LAMBDA_PUSH_NOTIFICATION_APPLE = 'MaaS-push-notification';

/**
 * Decider object owns flow and decision. When run with decide(), Decider
 * looks into flow, makes decions and finally sends the decisions to SWF.
 */
class Decider {

  constructor(flow) {
    if (!flow || !(flow instanceof TripWorkFlow)) {
      throw new Error('Cannot create Decider without TripWorkFlow');
    }
    this.flow = flow;
    this.decision = new Decision(this.flow);
    this.now = Date.now();
  }

  /**
   * Decide starts the decision making process, and submits the results to SWF.
   */
  decide() {
    return this._decide()
      .then(() => this._submit());
  }

  /**
   * Helper for generating decisions.
   */
  _decide() {

    // check did we understand the flow situation
    if (!this.flow.event && !this.flow.task) {
      console.error('[Decider] ERROR: lost flow event & task -- aborting');
      this.decision.abortFlow('Decider: lost flow event & task -- aborting');
      return Promise.resolve();
    }

    // check if somethings have failed
    if (this.flow.event === 'LambdaFunctionFailed') {
      console.warn('[Decider] LambdaFunctionFailed -- aborting');
      this.decision.abortFlow('Decider: LambdaFunctionFailed -- aborting');
      return Promise.resolve();
    }

    // cannot do anything if not based on itinerary..
    if (this.flow.trip.referenceType !== Trip.REF_TYPE_ITINERARY) {
      console.warn('[Decider] not itinerary based trip -- aborting');
      this.decision.abortFlow('Decider: not itinerary based trip -- aborting');
      return Promise.resolve();
    }

    // act according flow stage
    const taskName = this.flow.task && this.flow.task.name;
    console.info(`[Decider] Processing task '${taskName}'...`);
    let legId;
    switch (taskName) {
      // do some trip starting actions
      case TripWorkFlow.TASK_START_TRIP:
        return Itinerary.retrieve(this.flow.trip.referenceId)
          .then(itinerary => {
            // check if itinerary need to be paid
            if (itinerary.state === 'PLANNED') {
              return itinerary.pay()
                .catch(err => {
                  console.warn('[Decider] cannot pay itinerary, err:', err.stack || err);
                  const message = 'Payment of the trip failed. Click check your points and rebook the trip';
                  return this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }, message, 'Alert')
                    .then(() => Promise.reject(new Error('Payment failed')));
                });
            }
            // activate trip if starting in 5 mins, or schedule for later
            if (itinerary.startTime > this.now + (5 * 60 * 1000)) {
              this.decision.scheduleTimedTask(itinerary.startTime, TripWorkFlow.TASK_ACTIVATE_TRIP);
              console.info(`[Decider] decided to schedule task '${TripWorkFlow.TASK_ACTIVATE_TRIP}' ` +
                          `itinerary id '${this.flow.trip.referenceId}' into ${new Date(itinerary.startTime)}.`);
              return Promise.resolve(itinerary);
            }
            return this._activateItinerary(itinerary);
          })
          // process the legs
          .then(itinerary => this._processLegs(itinerary))
          // schedule trip closing into end after 30mins of end of the trip
          .then(() => {
            const timeout = (this.flow.trip.endTime || Date.now() + (24 * 60 * 60 * 1000)) + (30 * 60 * 1000);
            this.decision.scheduleTimedTask(timeout, TripWorkFlow.TASK_CLOSE_TRIP);
            console.info(`[Decider] decided to schedule task '${TripWorkFlow.TASK_CLOSE_TRIP}' ` +
                        `itinerary id '${this.flow.trip.referenceId}' into ${new Date(timeout)}.`);
            return Promise.resolve();
          })
          // handle  errors
          .catch(err => {
            if (err instanceof MaaSError && err.status === 404) {
              console.error(`[Decider] Itinerary ${this.flow.trip.referenceId} not found from DB, aborting flow`);
              this.decision.abortFlow(`Itinerary ${this.flow.trip.referenceId} not found from DB`);
            }
            console.error('[Decider] ERROR while starting the trip, err:', err.stack || err);
            return this._sendPushNotification('ObjectChange', { ids: [this.flow.trip.referenceId], objectType: 'Itinerary' });
          });

      // activation of trip
      case TripWorkFlow.TASK_ACTIVATE_TRIP:
        return Itinerary.retrieve(this.flow.trip.referenceId)
          .then(itinerary => {
            // check if in bad state
            if (['CANCELLED', 'CANCELLED_WITH_ERRORS', 'FINISHED', 'ABANDONED'].indexOf(itinerary.state) !== -1) {
              console.warn(`[Decider] Cannot start trip as Itinerary in state '${itinerary.state}'`);
              this.decision.abortFlow(`Decider: Itinerary already done (${itinerary.state}) -- aborting flow`);
              return this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' });
            }
            return this._activateItinerary(itinerary)
              .then(itinerary => this._processLegs(itinerary));
          })
          // handle unexpected errors
          .catch(err => {
            console.error('[Decider] ERROR while activating trip -- ignoring, err:', err.stack || err);
            return Promise.resolve();
          });

      case TripWorkFlow.TASK_CHECK_ITINERARY:
        // fetch itinerary & check legs from that leg
        return Itinerary.retrieve(this.flow.trip.referenceId)
          .then(itinerary => {
            if (itinerary.state !== 'PAID' && itinerary.state !== 'ACTIVATED') {
              return Promise.reject(`Cannot check Itinerary as in state '${itinerary.state}'`);
            }
            return Promise.resolve(itinerary);
          })
          // check the bookings in leg
          .then(itinerary => this._processLegs(itinerary))
          // handle unexpected errors
          .catch(err => {
            console.error('[Decider] ERROR while checking itinerary -- ignoring, err:', err.stack || err);
            return Promise.resolve();
          });

      case TripWorkFlow.TASK_CHECK_LEG:
        legId = this.flow.task && this.flow.task.params && this.flow.task.params.legId;
        // fetch itinerary & check leg
        return Itinerary.retrieve(this.flow.trip.referenceId)
          .then(itinerary => {
            if (itinerary.state !== 'PAID' && itinerary.state !== 'ACTIVATED') {
              return Promise.reject(`Cannot check leg as Itinerary in state '${itinerary.state}'`);
            }
            return Promise.resolve(itinerary);
          })
          // find and check the leg
          .then(itinerary => {
            return this._findLegFromItinerary(itinerary, legId)
              .then(leg => this._activateLeg(leg))
              .then(() => this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }));
          })
          // handle unexpected errors
          .catch(err => {
            console.error('[Decider] error while checking leg -- ignoring, err:', err.stack || err);
            return Promise.resolve();
          });

      case TripWorkFlow.TASK_CLOSE_TRIP:
        console.info(`[Decider] CLOSING TRIP WORK FLOW '${this.flow.id}'`);
        // fetch itinerary & end it
        this.decision.closeFlow('Decider: closing ended trip');
        return Itinerary.retrieve(this.flow.trip.referenceId)
          .then(itinerary => itinerary.finish())
          .then(itinerary => this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }))
          // handle unexpected errors
          .catch(err => {
            console.error('[Decider] error while closing trip -- ignoring, err:', err.stack || err);
            return Promise.resolve();
          });

      case TripWorkFlow.TASK_CANCEL_TRIP:
        // Cancel requested by user or external entity.
        // This assumes Itinerary is already cancelled, this just cleans the work flow
        console.info(`[Decider] CLOSING TRIP WORK FLOW '${this.flow.id}'`);
        this.decision.closeFlow('Decider: user requested cancellation');
        return Promise.resolve();

      default:
        console.warn(`[Decider] unknown taskName '${taskName}', aboring...`);
        this.decision.abortFlow(`Decider: unknown action '${taskName}' -- aborting`);
        return Promise.resolve();
    }

  }

  /**
   * Helper for submitting decisions to SWF.
   */
  _submit() {
    if (!this.decision || !this.flow) {
      throw new Error('Cannot submit decision');
    }

    // send decision to SWF
    return swfClient.respondDecisionTaskCompletedAsync(this.decision.decisionTaskCompletedParams)
      .then(data => {
        console.info(`[Decider] done with workflowId '${this.flow.id}'`);
        return Promise.resolve({ workFlowId: this.flow.id });
      })
      .catch(err => {
        console.error(`[Decider] responding decision for workflowId FAILED '${this.flow.id}'`, err);
        console.error(`decisionTaskCompletedParams: ${JSON.stringify(this.decision.decisionTaskCompletedParams, null, 2)}`);
        return Promise.reject(err);
      });
  }

  /**
   * Helper traverse itinerary legs and decide what to do them.
   */
  _processLegs(itinerary) {
    let nextCheckWakeUpTime;
    // Check legs. Capture failures with reflcect() so all legs will be processed regardless of individual errors
    let hasErrors = false;
    return Promise.mapSeries(itinerary.legs, leg => {
      // skip finished
      if (leg.state === 'FINISHED') {
        console.info(`[Decider] Skipping checking FINISHED leg id '${leg.id}'`);
        return Promise.resolve().reflect();
      }
      if (leg.state === 'ACTIVATED') {
        // finish legs that were active but now gone
        if (leg.endTime < this.now) { // eslint-disable-line max-depth
          console.info(`[Decider] Finishing leg id '${leg.id}'...`);
          return leg.finish().reflect();
        }
        console.info(`[Decider] Skipping checking ACTIVATED leg id '${leg.id}'`);
        return Promise.resolve().reflect();
      }
      // upcoming legs
      const activationTime = leg.activationTime();
      if (activationTime < this.now) {
        // need to activate this leg rightaway
        return this._activateLeg(leg).reflect();
      }
      if (!nextCheckWakeUpTime || nextCheckWakeUpTime > activationTime) {
        nextCheckWakeUpTime = activationTime;
      }
      return Promise.resolve().reflect();
    })
    .each(inspection => {
      if (!inspection.isFulfilled()) {
        console.error('[Decider] Error: Failed check/act for a leg: ', inspection.reason());
        hasErrors = true;
      }
    })
    // schedule next leg checking point if needed
    .then(() => {
      if (nextCheckWakeUpTime) {
        this.decision.scheduleTimedTask(nextCheckWakeUpTime + (5 * 1000), TripWorkFlow.TASK_CHECK_ITINERARY);
        console.info(`[Decider] decided to schedule task '${TripWorkFlow.TASK_CHECK_ITINERARY}' ` +
                     `into ${new Date(nextCheckWakeUpTime + (5 * 1000))}.`);
      }
      return Promise.resolve();
    })
    .then(() => {
      if (hasErrors === true) {
        console.warn('[Decider] legs processed, warning user about errors');
        const message = 'Problems with one or more bookings. Click to check the trip.';
        return this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }, message, 'Alert');
      }
      console.info('[Decider] legs processed');
      return this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' });
    });
  }

  /**
   * Helper to find a leg from itinerary
   */
  _findLegFromItinerary(itinerary, legId) {
    const legs = itinerary.legs.filter(leg => {
      return leg.id === legId;
    });
    return Promise.resolve(legs[0]);
  }

  /**
   * Helper check to activate itinerary
   */
  _activateItinerary(itinerary) {
    console.info(`[Decider] activating itinerary '${itinerary.id}'...`);
    return itinerary.activate()
      .then(itinerary => {
        let message = 'Your trip is about to start';
        // dig out bit information to form more informal message
        const legs = itinerary.legs;
        const lastLeg = legs[legs.length - 1];
        if (lastLeg.destination()) {
          message = `Your trip to ${lastLeg.destination()} is about to start`;
        }
        if (legs[0] && legs[1] && legs[1].isTransport()) {
          if (legs[0].isWalking()) {
            message += ` - leave for the ${legs[1].mode.toLowerCase()} now`;
          } else if (legs[0].isWaiting()) {
            message += ` - wait for the ${legs[1].mode.toLowerCase()}`;
          }
        }
        return this._sendPushNotification('TripActivate', { ids: [itinerary.id], objectType: 'Itinerary' }, message)
          .then(() => Promise.resolve(itinerary));
      });
  }

  /**
   * Helper check leg reservation & act if needed (TBD)
   */
  _activateLeg(leg) {
    console.info(`[Decider] activating leg '${leg.id}' in state '${leg.state}'...`);

    if (['FINISHED', 'CANCELLED', 'CANCELLED_WITH_ERRORS'].some(state => state === leg.state)) {
      console.info('[Decider] leg already done; ignoring');
      return Promise.resolve();
    }

    const transaction = new Transaction(this.flow.trip.identityId);
    // try to activate leg
    return transaction.start()
      .then(() => leg.activate(transaction, { tryReuseBooking: true }))
      .then(() => {
        // check booking if leg have one
        if (!leg.booking) {
          return transaction.commit();
        }
        const booking = leg.booking;
        if (booking.state !== 'RESERVED' && booking.state !== 'CONFIRMED' && booking.state !== 'ACTIVATED') {
          let message = `Problems with your ${leg.mode.toLowerCase()} ticket, please check`;
          if (leg.destination()) {
            message = `Problems with your ${leg.mode.toLowerCase()} ticket to ${leg.destination()}, please check`;
          }
          return this._sendPushNotification('ObjectChange', { ids: [booking.id], objectType: 'Booking' }, message, 'Alert')
          .then(() => transaction.commit());
        }
        return transaction.commit();
      })
      .then(() => {
        // if it is more than two minutues to leg start, schedule another check
        const checkWakeUpTime = leg.startTime - (2 * 60 * 1000);
        if (this.now < checkWakeUpTime) {
          this.decision.scheduleTimedTask(checkWakeUpTime, TripWorkFlow.TASK_CHECK_LEG, { legId: leg.id });
          console.info(`[Decider] decided to schedule task '${TripWorkFlow.TASK_CHECK_LEG}' leg id '${leg.id}' ` +
                      `into ${new Date(checkWakeUpTime)}.`);
        }
        return Promise.resolve();
      })
      .catch(err => {
        console.error('[Decider] Could not check leg!', err);
        console.error(err.stack);
        return transaction.rollback()
          .then(() => Promise.reject(`error while checking leg '${leg.id}', err: ${err}`));
      });
  }

  /**
   * Helper send push notification for user devices
   */
  _sendPushNotification(type, data, message, severity) {
    console.info(`[Decider] Sending push notification to user ${this.flow.trip.identityId}: '${message || '(no message)'}'`);

    const notifData = {
      identityId: this.flow.trip.identityId,
      badge: 0,
      type,
      message,
      data,
    };
    if (typeof message !== 'undefined') {
      notifData.message = message;
    }
    if (typeof severity !== 'undefined') {
      notifData.severity = severity;
    }

    return bus.call(LAMBDA_PUSH_NOTIFICATION_APPLE, notifData)
      .then(result => {
        console.info(`[Decider] Push notification to user ${this.flow.trip.identityId} sent, result:`, result);
      })
      .catch(err => {
        console.error(`[Decider] Error: Failed to send push notification to user ${this.flow.trip.identityId}, err:`, err);
      })
      .finally(() => {
        return Promise.resolve();
      });
  }

}

module.exports.respond = function (event, callback) {

  const flow = new TripWorkFlow();
  let decider;

  try {
    flow.assignDecisionTaskInput(event);
    decider = new Decider(flow);
  } catch (err) {
    console.info(`This event caused error: ${JSON.stringify(event, null, 2)}`);
    return callback(new MaaSError(err.message || err, 400));
  }

  return models.Database.init()
    .then(() => decider.decide())
    .then(response => {
      models.Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      models.Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });

    });
};
