'use strict';

const AWS = require('aws-sdk');
const bus = require('../../lib/service-bus');
const Database = require('../../lib/models/Database');
const Decision = require('../../lib/trip/Decision');
const Itinerary = require('../../lib/business-objects/Itinerary');
const MaaSError = require('../../lib/errors/MaaSError.js');
const Promise = require('bluebird');
const Transaction = require('../../lib/business-objects/Transaction');
const Trip = require('../../lib/trip/Trip');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');

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
    this.itinerary = null;
  }

  /**
   *  Decide generates one or more decisions that are ready to be submitted to SWF.
   */
  decide() {
    // check did we understand the flow situation
    if (!this.flow.event && !this.flow.task) {
      console.warn('[Decider] ERROR: lost flow event & task -- aborting');
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

    // get the itinerary & process the flow task
    return Itinerary.retrieve(this.flow.trip.referenceId)
      .catch(err => {
        console.warn('[Decider] ERROR cannot retrieve the Itinerary, err:', err.stack || err);
        console.warn(`[Decider] Aborting flow for Itinerary ${this.flow.trip.referenceId}`);
        this.decision.abortFlow(`Itinerary ${this.flow.trip.referenceId} couldn't be retrieved`);
        return this._sendPushNotification('ObjectChange', { ids: [this.flow.trip.referenceId], objectType: 'Itinerary' })
          .then(() => Promise.resolve());
      })
      .then(itinerary => {
        if (itinerary) {
          this.itinerary = itinerary;
          return this._processTask(this.flow.task);
        }
        return Promise.resolve();
      });
  }

  /**
   * Submit decistion to SWF.
   */
  submit() {
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
        console.warn(`[Decider] responding decision for workflowId FAILED '${this.flow.id}'`, err);
        console.warn(`decisionTaskCompletedParams: ${JSON.stringify(this.decision.decisionTaskCompletedParams, null, 2)}`);
        return Promise.reject(err);
      });
  }

  /**
   * Helper process given task and make decision(s)
   */
  _processTask(task) {
    if (!task || !task.name) {
      return Promise.reject('No task to process, aborting.');
    }
    if (!this.itinerary) {
      return Promise.reject('No itinerary to process, aborting.');
    }

    const itinerary = this.itinerary;
    const transaction = new Transaction(this.flow.trip.identityId);
    let legId;

    console.info(`[Decider] Processing task '${task.name}' for Itinerary ${itinerary.id}`);

    switch (task.name) {
      // do some trip starting actions
      case TripWorkFlow.TASK_START_TRIP:
        return Promise.resolve()
          // process itinerary activation
          .then(() => {
            // check if itinerary need to be paid
            if (itinerary.state !== 'PAID') {
              return Promise.reject('Cannot start trip as itinerary not paid.');
            }
            // activate trip if starting in 5 mins, othewise schedule for later
            if (itinerary.startTime > this.now + (5 * 60 * 1000)) {
              this.decision.scheduleTimedTask(itinerary.startTime, TripWorkFlow.TASK_ACTIVATE_TRIP);
              console.info(`[Decider] decided to schedule task '${TripWorkFlow.TASK_ACTIVATE_TRIP}' ` +
                          `itinerary id '${itinerary.id}' into ${new Date(itinerary.startTime)}.`);
              return Promise.resolve();
            }
            return this._activateItinerary();
          })
          // process the legs
          .then(() => this._processLegs())
          // schedule trip closing into end after 30 mins of end of the trip
          .then(() => {
            const timeout = (this.flow.trip.endTime || Date.now() + (24 * 60 * 60 * 1000)) + (30 * 60 * 1000);
            this.decision.scheduleTimedTask(timeout, TripWorkFlow.TASK_CLOSE_TRIP);
            console.info(`[Decider] decided to schedule task '${TripWorkFlow.TASK_CLOSE_TRIP}' ` +
                        `itinerary id '${itinerary.id}' into ${new Date(timeout)}.`);
            return Promise.resolve();
          })
          // handle errors
          .catch(err => {
            console.warn('[Decider] ERROR in task TASK_START_TRIP handing, err:', err.stack || err);
            const message = `Problems with your trip to ${itinerary.toName()}. Please check the trip plan.`;
            return this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }, message, 'Alert');
          });

      // activation of trip
      case TripWorkFlow.TASK_ACTIVATE_TRIP:
        return Promise.resolve()
          .then(() => {
            // check if in bad state
            if (['CANCELLED', 'CANCELLED_WITH_ERRORS', 'FINISHED', 'ABANDONED'].indexOf(itinerary.state) !== -1) {
              this.decision.abortFlow(`Trip already done (${itinerary.state}) -- aborting flow`);
              return Promise.reject(`Cannot start trip as Itinerary in state '${itinerary.state}', aborting flow`);
            }
            return this._activateItinerary()
              .then(() => this._processLegs());
          })
          // handle unexpected errors
          .catch(err => {
            console.warn('[Decider] ERROR in task TASK_ACTIVATE_TRIP handing, err:', err.stack || err);
            const message = `Problems with your trip to ${itinerary.toName()}. Please check the trip plan.`;
            return this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }, message, 'Alert');
          });

      case TripWorkFlow.TASK_CHECK_ITINERARY:
        return Promise.resolve()
          .then(() => {
            if (itinerary.state !== 'PAID' && itinerary.state !== 'ACTIVATED') {
              return Promise.reject(`Cannot check Itinerary as in state '${itinerary.state}'`);
            }
            return Promise.resolve();
          })
          // check the bookings in leg
          .then(() => this._processLegs())
          // handle unexpected errors
          .catch(err => {
            console.warn('[Decider] ERROR in task TASK_CHECK_ITINERARY handing, err:', err.stack || err);
            const message = `Possible problems with your trip to ${itinerary.toName()}. Please check the trip plan.`;
            return this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }, message, 'Alert');
          });

      case TripWorkFlow.TASK_CHECK_LEG:
        legId = task.params && task.params.legId;
        return Promise.resolve()
          .then(() => {
            if (itinerary.state !== 'PAID' && itinerary.state !== 'ACTIVATED') {
              return Promise.reject(`Cannot check leg as Itinerary in state '${itinerary.state}'`);
            }
            return Promise.resolve();
          })
          // find and check the leg
          .then(() => {
            return this._findLegFromItinerary(legId)
              .then(leg => this._activateLeg(leg))
              .then(() => this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }));
          })
          // handle unexpected errors
          .catch(err => {
            console.warn('[Decider] ERROR in task TASK_CHECK_LEG handing, err:', err.stack || err);
            const message = `Possible problems with your trip to ${itinerary.toName()}. Please check the trip plan.`;
            return this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }, message, 'Alert');
          });

      // eslint-disable-next-line
      case TripWorkFlow.TASK_CLOSE_TRIP:
        return transaction.start()
          .then(() => itinerary.finish(transaction))
          .then(() => {
            this.decision.closeFlow('Decider: closing ended trip');
            return Promise.resolve();
          })
          .then(() => this._sendPushNotification('ObjectChange', { ids: [itinerary.id], objectType: 'Itinerary' }))
          // handle unexpected errors
          .catch(err => {
            console.warn('[Decider] ERROR in task TASK_CLOSE_TRIP handing, ignoring, err:', err.stack || err);
            return Promise.resolve();
          })
          .finally(() => transaction.commit(`Your trip to ${itinerary.toName()} has finished`));

      case TripWorkFlow.TASK_CANCEL_TRIP:
        // Cancel requested by user or external entity.
        // This assumes Itinerary is already cancelled, this just cleans the work flow
        console.info(`[Decider] CLOSING TRIP WORK FLOW '${this.flow.id}'`);
        this.decision.closeFlow('Decider: user requested cancellation');
        return Promise.resolve();

      default:
        console.warn(`[Decider] unknown task name '${task.name}', aboring...`);
        this.decision.abortFlow(`Decider: unknown action '${task.name}' -- aborting`);
        return Promise.resolve();
    }
  }

  /**
   * Helper traverse itinerary legs and decide what to do them.
   */
  _processLegs() {
    let nextCheckWakeUpTime;
    // Check legs. Capture failures with reflcect() so all legs will be processed regardless of individual errors
    let hasErrors = false;
    return Promise.mapSeries(this.itinerary.legs, leg => {
      // skip finished
      if (leg.state === 'FINISHED') {
        console.info(`[Decider] Skipping checking FINISHED leg id '${leg.id}'`);
        return Promise.resolve().reflect();
      }
      if (leg.state === 'ACTIVATED') {
        // finish legs that were active but now gone
        if (leg.endTime < this.now) { // eslint-disable-line max-depth
          console.info(`[Decider] Finishing leg id '${leg.id}'...`);
          const transaction = new Transaction(this.flow.trip.identityId);
          return transaction.start()
            .then(() => leg.finish(transaction))
            .then(() => transaction.commit())
            .catch(error => transaction.rollback().then(() => Promise.reject(error)))
            .reflect();
        }
        console.info(`[Decider] Checking ACTIVATED leg id '${leg.id}'`);
        return this._activateLeg(leg).reflect();
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
        console.warn('[Decider] Error: Failed check/act for a leg: ', inspection.reason());
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
        return this._sendPushNotification('ObjectChange', { ids: [this.itinerary.id], objectType: 'Itinerary' },
                                          message, 'Alert');
      }
      console.info('[Decider] legs processed');
      return this._sendPushNotification('ObjectChange', { ids: [this.itinerary.id], objectType: 'Itinerary' });
    });
  }

  /**
   * Helper to find a leg from itinerary
   */
  _findLegFromItinerary(legId) {
    const legs = this.itinerary.legs.filter(leg => {
      return leg.id === legId;
    });
    return Promise.resolve(legs[0]);
  }

  /**
   * Helper check to activate itinerary
   */
  _activateItinerary() {
    console.info(`[Decider] activating itinerary '${this.itinerary.id}'...`);
    return this.itinerary.activate()
      .then(itinerary => {
        let message = 'Your trip is about to start';
        // dig out bit information to form more informal message
        const legs = itinerary.legs;
        const destination = itinerary.toName();
        if (destination) {
          message = `Your trip to ${destination} is about to start`;
        }
        if (legs[0] && legs[1] && legs[1].isTransport()) {
          if (legs[0].isWalking()) {
            message += ` - leave for the ${legs[1].mode.toLowerCase()} now`;
          } else if (legs[0].isWaiting()) {
            message += ` - wait for the ${legs[1].mode.toLowerCase()}`;
          }
        }
        return this._sendPushNotification('TripActivate', { ids: [itinerary.id], objectType: 'Itinerary' }, message);
      });
  }

  /**
   * Helper check leg reservation & act if needed
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
        // check that all OK with the booking
        if (!leg.booking || ['EXPIRED', 'RESERVED', 'CONFIRMED', 'ACTIVATED'].some(state => state === leg.booking.state)) {
          return transaction.commit();
        }
        // Booking is in an unexpected state, notify user.
        console.warn(`[Decider] Activating leg but Booking state '${leg.booking.state}', notifying user`);
        let message = `Problems with your ${leg.mode.toLowerCase()} booking, please check your trip plan`;
        if (leg.destination()) {
          message = `Problems with your ${leg.mode.toLowerCase()} booking to ${leg.destination()}, ` +
                    'please check your travel plan';
        }
        return transaction.commit()
          .then(() => this._sendPushNotification('ObjectChange', { ids: [this.itinerary.id], objectType: 'Itinerary' },
                                                 message, 'Alert'));
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
        console.warn('[Decider] Could not check leg!', err);
        console.warn(err.stack);
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
        console.warn(`[Decider] Error: Failed to send push notification to user ${this.flow.trip.identityId}, err:`, err);
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

  return Database.init()
    .then(() => decider.decide())
    .then(() => decider.submit())
    .then(
      response => Database.cleanup().then(() => response),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
