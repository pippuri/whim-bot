'use strict';

const Promise = require('bluebird');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const Decision = require('../../lib/trip/Decision');
const MaaSError = require('../../lib/errors/MaaSError.js');
//const bus = require('../../lib/service-bus');

/**
 * Runs activity task. This is typically invoked by SWF by a result of activity task appearing
 * in SWF queue (e.g. based on decision). This will invoke then other lambdas or API endpoints
 * to actually execute something, so it is more like wrapper for actual actions.
 *
 * @return {Promise -> object} Epmty object.
 */
function runActivityTask(event) {

  //console.log("runActivityTask() got event:", event)

  let flow;
  try {
    flow = new TripWorkFlow();
    flow.assignFlowInput(event);
  } catch(err) {
    return Promise.reject(err);
  }

  const response = {
    input: flow.flowInput,
    result: '???'
  };

  switch (flow.task) {
    case TripWorkFlow.TASK_CHECK_BOOKINGS:
      console.log("runActivityTask() checking bookings for trip:", flow.trip);

      // ....

      response.result = `${TripWorkFlow.TASK_CHECK_BOOKINGS} was a huge success!`;
      break;
    default:
      console.error("runActivityTask() got unkown task:", flow.task);
      return Promise.reject(new MaaSError(`runActivityTask() got unkown task: ${flow.task}`, 400));
      break;
  }

  return Promise.resolve(response);
}

module.exports.respond = function (event, callback) {
  return runActivityTask(event)
    .then((response) => callback(null, response))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};

