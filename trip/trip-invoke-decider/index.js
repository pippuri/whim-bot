'use strict';

const Promise = require('bluebird');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const Trip = require('../../lib/trip/Trip');
const Decision = require('../../lib/trip/Decision');
const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError.js');
const AWS = require('aws-sdk');

const swfClient = new AWS.SWF({ region: process.env.AWS_REGION });
Promise.promisifyAll(swfClient);

const LAMBDA_ITINERARY_RETRIEVE = 'MaaS-itinerary-retrieve';
const LAMBDA_BOOKING_RETRIEVE = 'MaaS-bookings-retrieve';

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
      return Promise.resolve();
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
    console.log(`Decider: Processing task '${taskName}'`);
    let legId;
    switch (taskName) {
      case TripWorkFlow.TASK_START_TRIP:
        // process whole itinerary
        return this._fetchItinerary()
          .then(itinerary => this._processLegs(itinerary))
          .then(() => {
            // schedule trip closing into end
            const timeout = (this.flow.trip.endTime || Date.now()) + (5 * 60 * 1000);
            this.decision.scheduleTimedTask(timeout, TripWorkFlow.TASK_CLOSE_TRIP);
            console.log(`Decider decided to schedule task '${TripWorkFlow.TASK_CLOSE_TRIP}' itinerary id '${this.flow.trip.referenceId}' ` +
                        `into ${new Date(timeout)}.`);
            return Promise.resolve();
          })
          .catch(err => {
            console.warn('Decider: cannot process itinerary -- aborting, err:', err.stack || err);
            this.decision.abortFlow(`Decider: cannot process itinerary -- aborting, err: ${err}`);
            return Promise.resolve();
          });
      case TripWorkFlow.TASK_CHECK_LEG:
         // fetch itinerary & check leg
        legId = this.flow.task && this.flow.task.params && this.flow.task.params.legId;
        return this._fetchItinerary()
          .then(itinerary => this._findLegFromItinerary(itinerary, legId))
          .then(leg => this._checkLeg(leg))
          .then(() => { return Promise.resolve(); })
          .catch(err => {
            console.warn('Decider: cannot check leg, err:', err.stack || err);
            // ... warn user: "check you journey"
            return Promise.resolve();
          });
      case TripWorkFlow.TASK_CLOSE_TRIP:
        console.log(`Decider: CLOSING TRIP WORK FLOW '${this.flow.id}'`);
        this.decision.closeFlow('Decider: closing ended trip');
        return Promise.resolve();
      case TripWorkFlow.TASK_CANCEL_TRIP:
        // Cancel requested by user or external entity.
        // Later this can e.g. do some booking cancelling etc.
        console.log(`Decider: CLOSING TRIP WORK FLOW '${this.flow.id}'`);
        this.decision.closeFlow('Decider: user requested cancellation');
        return Promise.resolve();
      default:
        console.warn(`Decider: unknown taskName '${taskName}', aboring...`);
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
        console.log(`Decider done with workflowId '${this.flow.id}'`);
        return Promise.resolve({ workFlowId: this.flow.id });
      })
      .catch(err => {
        console.error(`Decider responding decision for workflowId FAILED '${this.flow.id}'`, err);
        return Promise.reject(err);
      });
  }

  /**
   * Helper to fetch itinerary based on flow data
   */
  _fetchItinerary() {
    const data = {
      identityId: this.flow.trip.identityId,
      itineraryId: this.flow.trip.referenceId,
    };
    return bus.call(LAMBDA_ITINERARY_RETRIEVE, data)
      .then(response => {
        let result;
        if (response.itinerary) {
          console.log(`Decider fetched itinerary '${response.itinerary.id}'`);
          result = Promise.resolve(response.itinerary);
        } else {
          result = Promise.reject('cannot find itinerary');
        }
        return result;
      })
      .catch(err => {
        return Promise.reject(`error while fetching itinerary '${this.flow.trip.referenceId}', err: ${err}`);
      });
  }

  /**
   * Helper traverse itinerary legs and decide what to do them.
   */
  _processLegs(itinerary) {
    if (!this.decision || !itinerary.legs || !this.now || !this.flow) {
      throw new Error('Cannot parse itinerary; missing parameter(s)');
    }
    const promiseQueue = [];
    // traverse legs
    itinerary.legs.forEach(leg => {
      // right now we are interested only ongoing or future legs with a booking
      if (leg.bookingId && leg.endTime > this.now) {
        // check leg status now or schedule check before the leg starts
        const checkWakeUpTime = leg.startTime - (BOOKING_CHECK_TIME[leg.mode] || (30 * 60 * 1000));
        if (checkWakeUpTime < this.now) {
          promiseQueue.push(this._checkLeg(leg));
        } else {
          this.decision.scheduleTimedTask(checkWakeUpTime, TripWorkFlow.TASK_CHECK_LEG, { legId: leg.id });
          console.log(`Decider decided to schedule task '${TripWorkFlow.TASK_CHECK_LEG}' leg id '${leg.id}' ` +
                      `into ${new Date(checkWakeUpTime)}.`);
        }
      }
    });
    return Promise.all(promiseQueue);
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
   * Helper check leg & act if needed (TBD)
   */
  _checkLeg(leg) {
    // fetch booking
    const data = {
      identityId: this.flow.trip.identityId,
      bookingId: leg.bookingId,
      refresh: (leg.mode === 'TAXI').toString(), // TODO: Set always true
    };
    console.log(`Decider: checking booking id '${leg.bookingId}', mode '${leg.mode}', state '${leg.state}' ...`);
    return bus.call(LAMBDA_BOOKING_RETRIEVE, data)
      .then(booking => {
        // booking rules & actions
        if (booking.mode === 'TAXI' && booking.state === 'PAID') {
          console.log('Decider: TAXI booking that needs booking!');
          // ... book taxi!
          // ... alarm user: "Taxi confirmed"
        } else if (booking.state !== 'RESERVED') {
          console.log(`Decider: A booking in a wrong state '${booking.state}', expected 'RESERVED'`);
          // ..alarm user: "check journey, missing tickets!"
        } else {
          // all good!
          console.log('Decider: A booking looks good, no actions');
        }
        return Promise.resolve();
      })
      .catch(err => {
        // ..alarm user: ""
        console.error('Decider: Could not fetch booking!', err);
        return Promise.reject(`error while fetching booking '${leg.bookingId}', err: ${err}`);
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

