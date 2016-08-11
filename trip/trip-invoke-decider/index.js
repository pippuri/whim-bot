'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const Decision = require('../../lib/trip/Decision');
const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError.js');

const swfClient = new AWS.SWF({ region: process.env.AWS_REGION });
Promise.promisifyAll(swfClient);

const LAMBDA_ITINERARY_RETRIEVE = 'MaaS-itinerary-retrieve';

/**
 * Decider object owns flow and decision. When run with decide(), Decider
 * looks into flow, makes decions and finally sends the decisions to SWF.
 */
class Decider {

  constructor(flow) {
    if (!flow || !(flow instanceof TripWorkFlow)) {
      throw new MaaSError('Cannot create Decider without TripWorkFlow', 400);
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
    if (this.flow.trip.referenceType !== 'itinerary') {
      console.warn('Decider: not itinerary based trip -- aborting');
      this.decision.abortFlow('Decider: not itinerary based trip -- aborting');
      return Promise.resolve();
    }

    // act according flow stage
    const taskName = this.flow.task && this.flow.task.name;
    console.log(`Decider: Processing task '${taskName}'`);
    switch (taskName) {
      case TripWorkFlow.TASK_START_TRIP:
        // process whole itinerary
        return this._fetchItinerary()
          .then(itinerary => this._processLegs(itinerary))
          .then(() => {
            // schedule trip closing into end
            this.decision.scheduleTimedTask((this.flow.trip.endTime || Date.now()) + (5 * 60 * 1000), TripWorkFlow.TASK_CLOSE_TRIP);
            return Promise.resolve();
          })
          .catch(err => {
            console.warn('Decider: cannot process itinerary -- aborting', err);
            this.decision.abortFlow(`Decider: cannot process itinerary -- aborting, err: ${err}`);
            return Promise.resolve();
          });
      case TripWorkFlow.TASK_CLOSE_TRIP:
        console.log(`Decider: CLOSING TRIP '${this.flow.task && this.flow.task.params}'`);
        this.decision.closeFlow();
        return Promise.resolve();
      case TripWorkFlow.TASK_CHECK_BOOKING:
        // ... fetch booking and check it :)
        console.log(`Decider: CHECKING BOOKING '${this.flow.task && this.flow.task.params}'`);
        return Promise.resolve();
      default:
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
      filter: '',
    };
    return bus.call(LAMBDA_ITINERARY_RETRIEVE, data)
      .then(response => {
        console.log('Decider: checking itinerary-retrieve response:', response);
        // find right itinerary
        const itinerary = response.itineraries && response.itineraries.find(itinerary => {
          return itinerary.id === this.flow.trip.referenceId;
        });
        let result;
        if (itinerary) {
          result = Promise.resolve(itinerary);
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

    // traverse legs
    itinerary.legs.forEach(leg => {
      if (leg.bookingId) {
        // check leg status or schedule check before half an hour before leg starts
        if (leg.startTime - (35 * 1000) < this.now) {
          //_checkLegBooking(leg);
          console.log(`Decider WOULD decide to check booking id '${leg.bookingId}' (${leg.mode} in state ${leg.state})`);
        } else {
          const timeout = leg.startTime - (30 * 1000);
          this.decision.scheduleTimedTask(timeout, TripWorkFlow.TASK_CHECK_BOOKING, leg.bookingId);
          console.log(`Decider decided to schedule task '${TripWorkFlow.TASK_CHECK_BOOKING}' booking id '${leg.bookingId}' ` +
                      `into ${new Date(timeout)}.`);
        }
      }
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
    return callback(err);
  }

  return decider.decide()
    .then(response => callback(null, response))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};

