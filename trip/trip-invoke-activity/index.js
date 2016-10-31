'use strict';

const Promise = require('bluebird');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError.js');

/**
 * Runs activity task. This is typically invoked by SWF by a result of activity task appearing
 * in SWF queue (e.g. based on decision). This will invoke then other lambdas or API endpoints
 * to actually execute something, so it is more like wrapper for actual actions.
 *
 * @return {Promise -> object} Epmty object.
 */
function runActivityTask(event) {

  //console.info("runActivityTask() got event:", event)

  let flow;
  try {
    flow = new TripWorkFlow();
    flow.assignEventInputData(event);
  } catch (err) {
    return Promise.reject(err);
  }

  const response = {
    input: flow.flowInput,
    result: '???',
  };

  // TODO: set right stage within the call!
  return bus.call(flow.task.serviceName, flow.task.event)
    .then(result => {
      console.error('Lambda invoke success, result', result);
      response.result = result;
      return Promise.resolve(response);
    })
    .catch(err => {
      console.error('Lambda invoke fail');
      return Promise.reject(err);
    });

}

module.exports.respond = function (event, callback) {
  return runActivityTask(event)
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
