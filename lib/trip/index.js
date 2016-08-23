'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const Trip = require('./Trip');
const TripWorkFlow = require('./TripWorkFlow');

const swfClient = new AWS.SWF({ region: process.env.AWS_REGION });
Promise.promisifyAll(swfClient);

/**
 * Create trip. Trip represents any user movement we want system to track. It can
 * be based on itinerary or just plain booking.
 *
 * @return {Promise -> object} Object to contain workFlowId.
 */
module.exports.create = function (params) {

  // try to create trip and workflow
  let flow;
  try {
    flow = new TripWorkFlow();
    flow.addTrip(new Trip(params.referenceId, params.referenceType, params.identityId, params.endTime));
    flow.assignEventInputData({
      task: {
        name: TripWorkFlow.TASK_START_TRIP,
      },
    });
  } catch (error) {
    return Promise.reject(error);
  }

  // kick-off flow
  return swfClient.startWorkflowExecutionAsync(flow.startWorkflowExecutionParams)

    .then(data => {
      console.info(`Trip create() successfull, workflow '${flow.id}' started!`);
      return Promise.resolve({ workFlowId: flow.id, runId: data.runId });
    })

    .catch(err => {
      console.warn('Trip create() failure!', err);
      return Promise.reject(err);
    });
};

/**
 * Create trip based on itinerary.
 *
 * @return {Promise -> object} Original itinerary.
 */
module.exports.startWithItinerary = function (itinerary) {

  return module.exports.create({
    identityId: itinerary.identityId,
    referenceId: itinerary.id,
    referenceType: Trip.REF_TYPE_ITINERARY,
    startTime: itinerary.startTime,
    endTime: itinerary.endTime,
  })
  .then(flow => {
    // later we may add reference to trip into itinerary
    return Promise.resolve(itinerary);
  })
  .catch(err => {
    // for now we don't care if trip creating fails, until we understand how SWF works in real life
    console.warn(`Warning; NO Trip work flow crated for itinerary '${itinerary.id}', ignoring...`);
    return Promise.resolve(itinerary);
  });

};
