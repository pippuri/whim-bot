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
module.exports.create = function(params) {

  // try to create trip and workflow for it
  let flow;
  try {
    flow = new TripWorkFlow();
    flow.addTrip(new Trip(params));
  } catch (error) {
    return Promise.reject(error)
  }

  // kick-off flow
  return swfClient.startWorkflowExecutionAsync(flow.startWorkflowExecutionParams)

    .then(data => {
      console.log(`Trip create() successfull, workflow '${flow.id}' started!`);
      Promise.resolve({ workFlowId: flow.id });
    })

    .catch(err => {
      console.log("Trip create() failure!", err);
      Promise.reject(err);
    });
}
