'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const Decision = require('../../lib/trip/Decision');
const bus = require('../../lib/service-bus');

const swfClient = new AWS.SWF({ region: process.env.AWS_REGION });
Promise.promisifyAll(swfClient);

const LAMBDA_ITINERARY_RETRIEVE = 'MaaS-itinerary-retrieve';
const LAMBDA_ITINERARY_UPDATE = 'MaaS-itinerary-update';

/**
 * Decider
 *
 * @return {Promise -> Decision} Decision object containing needed data to repond SWF.
 */

class Decider {

  constructor(flow) {
    if (!flow || !(flow instanceof TripWorkFlow)) {
      throw new MaaSError(`Cannot create Decider without TripWorkFlow`, 400);
    }
    this.flow = flow;
    this.decision = new Decision(this.flow);
    this.now = Date.now();
  }

  decide() {
    return this._decide()
      .then(this._submit)
  }

  _decide() {
    // cannot do anything if not based on itinerary..
    if (this.flow.trip.referenceType !== 'itinerary') {
      console.warn(`Decider: not itinerary based trip -- aborting`);
      this.decision.abortFlow("Decider: not itinerary based trip -- aborting");
      return Promise.resolve();
    }

    // check did we understand the flow situation
    if (!this.flow.event && !this.flow.task) {
      console.warn(`Decider: lost flow event & task -- aborting`);
      this.decision.abortFlow("Decider: lost flow event & task -- aborting");
      return Promise.resolve();
    }

    // check if somethings have failed
    if (flow.event === 'LambdaFunctionFailed') {
      console.warn(`Decider: LambdaFunctionFailed -- aborting`);
      this.decision.abortFlow("Decider: LambdaFunctionFailed -- aborting");
      return Promise.resolve();
    }

    // act according flow stage
    console.log(`Decider: Processing task '${flow.task && flow.task.name}'`);
    switch (flow.task && flow.task.name) {
      case TripWorkFlow.TASK_START_TRIP:
        // process whole itinerary
        return this._fetchItinerary()
          .then(itinerary => this._processLegs(itinerary))
          .then(() => {
            // schedule trip closing into end
            this.decision.scheduleTimedTask(leg.stopTime + (5 * 1000), TripWorkFlow.TASK_CLOSE_TRIP);
            return Promise.resolve();
          })
          .catch(err => {
            console.warn(`Decider: cannot process itinerary -- aborting`, err);
            this.decision.abortFlow(`Decider: cannot process itinerary -- aborting, err: ${err}`);
            return Promise.resolve();
          })
        break;
      case TripWorkFlow.TASK_CLOSE_TRIP:
        this.decision.closeFlow();
        return Promise.resolve();
        break;
      case TripWorkFlow.TASK_CHECK_BOOKING:
        // ... fetch booking and check it :)
        console.log(`Decider: CHECKING BOOKING '${flow.task && flow.task.id}'`)
        return Promise.resolve();
        break;
      default:
        break;
    }

  }

  _submit() {
    if (!this.decision || !this.flow) {
      throw new Error("Cannot submit decision");
    }
    // send decision to SWF
    return swfClient.respondDecisionTaskCompletedAsync(this.decision.decisionTaskCompletedParams)
      .then(data => {
        console.log(`Decider done with workflowId '${this.flow.id}'`);
        return Promise.resolve({ workFlowId: flow.id });
      })
      .catch(err => {
        console.error(`Decider responding decision for workflowId FAILED '${this.flow.id}'`, err);
        return Promise.reject(err);
      });
  }

  /**
   * Helper to fetch itinerary
   */
  _fetchItinerary() {
    let data = {
      identityId: this.flow.trip.identityId,
      itineraryId: this.flow.trip.referenceId,
      filter: ""
    }
    return bus.call(LAMBDA_ITINERARY_RETRIEVE, data)
      .then(itineraries => {
        console.log(`Decider: checking itineraries:`, itineraries);
        // find right itinerary
        let itinerary = itineraries.find(itinerary => {
          return itinerary.id === this.flow.trip.referenceId
        })
        if (itinerary) {
          return Promise.resolve(itinerary);
        } else {
          return Promise.reject(`cannot find itinerary '${id}'`);
        }
      })
      .catch(err => {
        Promise.reject(`error while fetching itinerary '${id}', err: ${err}`);
      });
  }

  /**
   * Helper tvaverse itinerary.
   */
  _processLegs(itinerary) {
    if (!this.decision || !itinerary.legs || !this.now || !this.flow) {
      throw new Error("Cannot parse itinerary");
    }
    // traverse legs
    itinerary.legs.forEach(leg => {
      if (leg.booking) {
        // check leg status or schedule check before half an hour before leg starts
        if (leg.startTime - (35 * 1000) > this.now) {
          //_checkLegBooking(leg);
        } else {
          let timeout = leg.startTime - (33 * 1000);
          this.decision.scheduleTimedTask(leg.startTime - (33 * 1000), TripWorkFlow.TASK_CHECK_BOOKING, leg.booking.id);
          console.log(`Decider decided to schedule task '${TripWorkFlow.TASK_CHECK_BOOKING}' booking id '${leg.booking.id}' ` +
                      `into ${new Date(timeout)}.`);
        }
      }
    })
  }

}

module.exports.respond = function (event, callback) {

  let flow = new TripWorkFlow();
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

