'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const moment = require('moment');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const bus = require('../../lib/service-bus');

const swfClient = new AWS.SWF({ region: process.env.AWS_REGION });
Promise.promisifyAll(swfClient);

const LAMBDA_TRIP_INVOKE_DECIDER = 'MaaS-trip-invoke-decider'

/**
 * Makes a polling call to AWS SFW. The call usually blocks for 70 seconds or until a decition
 * appears from the queue. Once polling returns a decition task, this method handles it and
 * start polling again if there is still time (defined by maxBlockingTimeInSec).
 *
 * This function is typically called from a worker process keeps the polling ongoing continously.
 *
 * @return {Promise -> object} Epmty object.
 */
function pollForDecisionTasks(params) {

  if (!params || !params.maxBlockingTimeInSec) {
    params.maxBlockingTimeInSec = 100;
    console.log("pollForDecisionTasks() defaulting maxBlockingTimeInSec into 100 sec");
  }
  if (typeof(params.maxBlockingTimeInSec) !== 'number'
      || params.maxBlockingTimeInSec < 100
      || params.maxBlockingTimeInSec > 300) {
    return Promise.reject(new MaaSError(`maxBlockingTimeInSec need to be 100..300 (sec)`, 400));
  }

  const pollingStartTime = Date.now();

  /**
   * Helper function to chain polling events (recursive promise chain)
   *
   * @return {}
   */
  function nextPoll() {
    // current execution time (ms) > maxRunTime timeout (sec) - pollForDecisionTaskAsync timeout (sec)
    console.log(`pollForDecisionTasks() polling was started ${moment().diff(pollingStartTime, 'seconds')} seconds ago`);
    if (Date.now() - pollingStartTime > (params.maxBlockingTimeInSec - 70) * 1000) {
      console.log("pollForDecisionTasks() reaching maxBlockingTimeInSec, exiting");
      return Promise.resolve();
    }

    console.log("pollForDecisionTasks() waiting a decision from SWF...");

    const flow = new TripWorkFlow();

    // retrieve from SWF, this can block max 70 seconds if there are no decisions to make
    return swfClient.pollForDecisionTaskAsync(flow.pollForDecisionTaskParams)
      .then(data => {
        //console.log("pollForDecisionTasks() got data:", JSON.stringify(data));

        // check do we have proper decition to process...
        if (!data.startedEventId || data.startedEventId === 0 ) {
          // no decition tasks to process --> pollForDecisionTask() timeout, do it again
          return nextPoll();
        }

        console.log("pollForDecisionTasks() invoking decider to process inbound decision task...");
        bus.call(LAMBDA_TRIP_INVOKE_DECIDER, data)
          .then(result => {
            console.log(`pollForDecisionTask() decider handled workflowId '${result.workFlowId}'`);
          })
          .catch(err => {
            console.error(`pollForDecisionTask() decider FAILED; `, err);
          });

        return nextPoll();

      })
      .catch(err => {
        console.error("pollForDecisionTask() polling or decision error", err);
        return Promise.reject(err);
      });
  }

  // start recursive polling
  return nextPoll();

}

module.exports.respond = function (event, callback) {
  // maxBlockingTimeInSec should be same or less than lambda execution timeout
  // defined in s-function.json.
  return pollForDecisionTasks({ maxBlockingTimeInSec: 150 })
    .then(() => callback(null, null))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};
