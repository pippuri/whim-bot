'use strict';

const Promise = require('bluebird');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const Trip = require('../../lib/trip/Trip');
const Decision = require('../../lib/trip/Decision');
const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError.js');
const AWS = require('aws-sdk');
const Itinerary = require('../../lib/business-objects/Itinerary');

const swfClient = new AWS.SWF({ region: process.env.AWS_REGION });
Promise.promisifyAll(swfClient);

const LAMBDA_PUSH_NOTIFICATION_APPLE = 'MaaS-push-notification-apple';

const BOOKING_CHECK_TIME = {
  TRAM: (15 * 60 * 1000),
  TRAIN: (25 * 60 * 1000),
  TAXI: (15 * 60 * 1000),
};

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
      console.warn('Decider: lost flow event & task -- aborting');
      this.decision.abortFlow('Decider: lost flow event & task -- aborting');
      return this._notifyUser('Check the journey plans: Automatic ticket booking stopped abruptly');
    }

    // check if somethings have failed
    if (this.flow.event === 'LambdaFunctionFailed') {
      console.warn('Decider: LambdaFunctionFailed -- aborting');
      this.decision.abortFlow('Decider: LambdaFunctionFailed -- aborting');
      return Promise.resolve();
    }

    // cannot do anything if not based on itinerary..
    if (this.flow.trip.referenceType !== Trip.REF_TYPE_ITINERARY) {
      console.warn('Decider: not itinerary based trip -- aborting');
      this.decision.abortFlow('Decider: not itinerary based trip -- aborting');
      return Promise.resolve();
    }

    // act according flow stage
    const taskName = this.flow.task && this.flow.task.name;
    console.log(`[Decider] Processing task '${taskName}'...`);
    let legId;
    switch (taskName) {
      case TripWorkFlow.TASK_START_TRIP:
        // process whole itinerary
        return Itinerary.retrieve(this.flow.trip.referenceId)
          // check itinerary actions
          .then(itinerary => {
            if (['CANCELLED', 'CANCELLED_WITH_ERRORS', 'FINISHED', 'ABANDONED'].indexOf(itinerary.state) !== -1) {
              console.warn(`[Decider] Cannot start trip as Itinerary in state '${itinerary.state}'`);
              return Promise.reject(`Cannot start trip as Itinerary in state '${itinerary.state}'`);
            }
            if (itinerary.state === 'PLANNED') {
              return itinerary.pay()
                .catch(err => {
                  console.warn('[Decider] cannot pay itinerary, err:', err.stack || err);
                  return this._notifyUser('Failed to make payment for the journey!')
                    .then(() => Promise.reject('Payment failed'));
                });
            }
            return Promise.resolve(itinerary);
          })
          // check the bookings in leg
          .then(itinerary => this._processLegs(itinerary))
          // schedule trip closing into end, defaulting to one day
          .then(() => {
            const timeout = (this.flow.trip.endTime || Date.now() + (24 * 60 * 60 * 1000)) + (30 * 60 * 1000);
            this.decision.scheduleTimedTask(timeout, TripWorkFlow.TASK_CLOSE_TRIP);
            console.log(`[Decider] decided to schedule task '${TripWorkFlow.TASK_CLOSE_TRIP}' ` +
                        `itinerary id '${this.flow.trip.referenceId}' into ${new Date(timeout)}.`);
            return Promise.resolve();
          })
          // handle unexpected errors
          .catch(err => {
            console.error('[Decider] cannot process itinerary -- aborting, err:', err.stack || err);
            this.decision.abortFlow(`Decider: cannot process itinerary -- aborting, err: ${err}`);
            return Promise.resolve();
          });
      case TripWorkFlow.TASK_CHECK_ITINERARY:
        legId = this.flow.task && this.flow.task.params && this.flow.task.params.legId;
        // fetch itinerary & check legs from that leg
        return Itinerary.retrieve(this.flow.trip.referenceId)
          .then(itinerary => {
            if (itinerary.state !== 'PAID' && itinerary.state !== 'ACTIVATED') {
              console.warn(`[Decider] Cannot check Itinerary as in state '${itinerary.state}'`);
              return Promise.reject(`Cannot check Itinerary as in state '${itinerary.state}'`);
            }
            return Promise.resolve(itinerary);
          })
          // check the bookings in leg
          .then(itinerary => this._processLegs(itinerary, legId))
          // handle unexpected errors
          .catch(err => {
            console.error('[Decider] cannot process itinerary -- aborting, err:', err.stack || err);
            this.decision.abortFlow(`Decider: cannot process itinerary -- aborting, err: ${err}`);
            return Promise.resolve();
          });
      case TripWorkFlow.TASK_CHECK_LEG:
        legId = this.flow.task && this.flow.task.params && this.flow.task.params.legId;
        // fetch itinerary & check leg
        return Itinerary.retrieve(this.flow.trip.referenceId)
          .then(itinerary => {
            if (itinerary.state !== 'PAID' && itinerary.state !== 'ACTIVATED') {
              console.warn(`[Decider] Cannot check leg as Itinerary in state '${itinerary.state}'`);
              return Promise.reject(`Cannot check leg as Itinerary in state '${itinerary.state}'`);
            }
            return Promise.resolve(itinerary);
          })
          // check the bookings in leg
          .then(itinerary => this._findLegFromItinerary(legId))
          .then(leg => this._checkLegReservation(leg))
          // handle unexpected errors
          .catch(err => {
            console.error('[Decider] cannot process itinerary -- ignoring, err:', err.stack || err);
            return Promise.resolve();
          });
      case TripWorkFlow.TASK_CLOSE_TRIP:
        console.log(`[Decider] CLOSING TRIP WORK FLOW '${this.flow.id}'`);
        this.decision.closeFlow('Decider: closing ended trip');
        return Promise.resolve();
      case TripWorkFlow.TASK_CANCEL_TRIP:
        // Cancel requested by user or external entity.
        // Later this can e.g. do some booking cancelling etc.
        console.log(`[Decider] CLOSING TRIP WORK FLOW '${this.flow.id}'`);
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
        console.log(`[Decider] done with workflowId '${this.flow.id}'`);
        return Promise.resolve({ workFlowId: this.flow.id });
      })
      .catch(err => {
        console.error(`[Decider] responding decision for workflowId FAILED '${this.flow.id}'`, err);
        return Promise.reject(err);
      });
  }

  /**
   * Helper traverse itinerary legs and decide what to do them.
   */
  _processLegs(itinerary, currentLegId) {
    if (!this.decision || !this.now || !this.flow) {
      throw new Error('Cannot parse itinerary; missing parameter(s)');
    }
    const promiseQueue = [];

    let startIndex = 0;
    if (currentLegId) {
      const currentLegIdIndex = this.itinerary.legs.indexOf(currentLegId);
      if (currentLegIdIndex !== -1) {
        startIndex = currentLegIdIndex;
      }
    }

    // check next legs
    for (let i = startIndex; i < itinerary.legs.length; i++) {
      const leg = itinerary.legs[i];
      // this point we are only interested in ongoing or future legs with a booking
      if (!leg.booking || leg.endTime < this.now) {
        console.log(`[Decider] Skipping checking leg id '${leg.id}'; too old or no booking`);
        continue;
      }
      const checkWakeUpTime = leg.startTime - (BOOKING_CHECK_TIME[leg.mode] || (30 * 60 * 1000));
      if (checkWakeUpTime < this.now) {
        // need to check this leg rightaway
        promiseQueue.push(this._checkLegReservation(leg).reflect());
      } else {
        // No near time upcoming legs anymore; stop checking them but schedule next checking point.
        // Strong assumption legs are in time ordered!
        this.decision.scheduleTimedTask(checkWakeUpTime, TripWorkFlow.TASK_CHECK_ITINERARY, { legId: leg.id });
        console.log(`[Decider] decided to schedule task '${TripWorkFlow.TASK_CHECK_ITINERARY}' leg id '${leg.id}' ` +
                    `into ${new Date(checkWakeUpTime)}.`);
        break;
      }
    }

    // process those legs that need immediate attention (capture failures so returns always success)
    let hasErrors = false;
    return Promise.all(promiseQueue)
      .each(inspection => {
        if (!inspection.isFulfilled()) {
          console.error('[Decider] Error: Failed check/act for a leg, ignoring: ', inspection.reason());
          hasErrors = true;
        }
      })
      .then(() => {
        if (hasErrors === true) {
          return this._notifyUser('Check the journey plan: Was not able to confirm all bookings');
        }
        return Promise.resolve();
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
   * Helper check leg reservation & act if needed (TBD)
   */
  _checkLegReservation(leg) {
    console.log(`[Decider] checking leg reservation '${leg.id}' in state '${leg.state}'...`);

    if (leg.state === 'FINISHED' || leg.state === 'CANCELLED' || leg.state === 'CANCELLED_WITH_ERRORS') {
      return Promise.resolve();
    }

    if (leg.state !== 'PAID' && leg.state !== 'ACTIVATED') {
      return this._notifyUser('Check the journey plan: Problems with one of the legs');
    }

    const booking = leg.booking;

    // try to reserve booking if needed, otherwise just refresh booking
    let bookingAction;
    if (booking.state === 'PAID') {
      bookingAction = booking.reserve()
        .then(() => this._notifyUser('Ticket to your journey has been just confirmed'))
        .catch(err => this._notifyUser('Problems in booking tickets; please check your journey plan!'));
    } else {
      bookingAction = leg.booking.refresh();
    }

    return bookingAction
      .then(() => {
        // check that booking is now OK (e.g. refresh has happened)
        if (booking.state !== 'RESERVED' && booking.state !== 'CONFIRMED' && booking.state !== 'ACTIVATED') {
          return this._notifyUser('Check the journey plan: Problems with one of the bookings');
        }
        return Promise.resolve();
      })
      .then(() => {
        // if it is more than two minutues to leg start, schedule another check
        const checkWakeUpTime = leg.startTime - (2 * 60 * 1000);
        if (this.now < checkWakeUpTime) {
          this.decision.scheduleTimedTask(checkWakeUpTime, TripWorkFlow.TASK_CHECK_LEG, { legId: leg.id });
          console.log(`[Decider] decided to schedule task '${TripWorkFlow.TASK_CHECK_LEG}' leg id '${leg.id}' ` +
                      `into ${new Date(checkWakeUpTime)}.`);
        }
      })
      .catch(err => {
        console.error('Decider: Could not check leg!', err);
        return Promise.reject(`error while checking leg '${leg.id}', err: ${err}`);
      });
  }

  /**
   * Helper send push notification for user
   */
  _notifyUser(message) {
    const notifData = {
      identityId: this.flow.trip.identityId,
      message: message,
    };
    return bus.call(LAMBDA_PUSH_NOTIFICATION_APPLE, notifData);
  }

}

module.exports.respond = function (event, callback) {

  const flow = new TripWorkFlow();
  let decider;

  try {
    flow.assignDecisionTaskInput(event);
    decider = new Decider(flow);
  } catch (err) {
    console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
    return callback(new MaaSError(err.message || err, 400));
  }

  return decider.decide()
    .then(response => callback(null, response))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};

