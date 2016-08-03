'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const moment = require('moment');
const MaaSError = require('../../lib/errors/MaaSError.js');
const Trip = require('./Trip');
const TripWorkFlow = require('./TripWorkFlow');
const Decision = require('./Decision');

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

/**
 * Makes a polling call to AWS SFW. The call usually blocks for 70 seconds or until a decition
 * appears from the queue. Once polling returns a decition task, this method handles it and
 * start polling again if there is still time (defined by maxBlockingTimeInSec).
 *
 * This function is typically called from a worker process keeps the polling ongoing continously.
 *
 * To improve functionality, once a task appears, this could launch separate lambda to handle it.
 *
 * @return {Promise -> object} Epmty object.
 */
module.exports.pollForDecisionTasks = function(params) {

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
    return swfClient.pollForDecisionTaskAsync(flow.pollForDecisionTaskParams)
      .then(data => {
        console.log("...pollForDecisionTasks() processing data...");

        // check do we have proper decition to process...
        if (!data.startedEventId || data.startedEventId === 0 ) {
          // no decition tasks to process --> pollForDecisionTask() timeout, do it again
          return nextPoll();
        }

        if (!flow.assertType(data.workflowType)) {
          console.error(`pollForDecisionTasks(): dow't know how to process this decision: '${data.workflowType}'`);
          return nextPoll();
        }

        flow.taskToken = data.taskToken;
        flow.id = data.workflowExecution && data.workflowExecution.workflowId;;

        console.log(`pollForDecisionTask() running decision task for workflowId '${flow.id}'...`);

        // parse decision & invoke decision task; for now we just run decision
        // tasks one by one, maybe later this can be parallerlized
        return _decider(flow, data.events)
          .then(decision => {
            console.log("pollForDecisionTasks() responding with a decision...");
            return swfClient.respondDecisionTaskCompletedAsync(decision.decisionTaskCompletedParams);
          })
          .then(data => {
            // done, continue polling
            return nextPoll();
          })

      })
      .catch(err => {
        console.error("pollForDecisionTask() polling or decision error", err);
        return Promise.reject(err);
      });
  }

  // start recursive polling
  return nextPoll();

}

/**
 * Runs activity task. This is typically invoked by SWF by a result of activity task appearing
 * in SWF queue (e.g. based on decision). This will invoke then other lambdas or API endpoints
 * to actually execute something, so it is more like wrapper for actual actions.
 *
 * @return {Promise -> object} Epmty object.
 */
module.exports.runActivityTask = function (event) {

  console.log("runActivityTask() got event:", event)

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
      return Promise.reject(new Error("runActivityTask() got unkown task:", flow.task));
      break;
  }

  return Promise.resolve(response);
}

/**
 * This helper task to handle decision by pollForDecisionTasks().
 *
 * @return {Promise -> Decision} Decision object containing needed data to repond SWF.
 */
function _decider(flow, events) {

  try {
    let decision = new Decision(flow);

    // traverse event history until we know what to do
    // return == all done, break == continue looping events
    (() => {
      for (let event of events) {
        switch (event.eventType) {
          case 'DecisionTaskStarted':
          case 'DecisionTaskScheduled':
            break;
          case 'LambdaFunctionCompleted':
            console.log(`Decider processing past event 'LambdaFunctionCompleted'...`);
            // looks like there has been activity task run, check results
            let results = event.lambdaFunctionCompletedEventAttributes;
            console.log(`Decider found LambdaFunction results:`, results);
            let result = JSON.parse(results.result)
            flow.assignFlowInput(result.input);

            //....

            console.log(`Decider: flow '${flow.id}' task '${flow.flowInput.task}' result: `, result.result);
            decision.addTask(TripWorkFlow.TASK_CLOSE_TRIP);
            console.log(`Decider deciced to schedule task '${TripWorkFlow.TASK_CLOSE_TRIP}'`);
            return;
          case 'WorkflowExecutionStarted':
            console.log(`Decider processing past event 'WorkflowExecutionStarted'...`);
            let input = event.workflowExecutionStartedEventAttributes
                        && event.workflowExecutionStartedEventAttributes.input
                        || "{}";
            flow.assignFlowInput(JSON.parse(input));
            if (flow.trip.referenceType === 'itinerary') {
              decision.addTask(TripWorkFlow.TASK_CHECK_BOOKINGS);
              console.log(`Decider deciced to schedule task '${TripWorkFlow.TASK_CHECK_BOOKINGS}'`);
            }
            return;
          default:
            console.warn(`Decider found unknown event '${event.eventType}', ignoring...`);
            break;
        }
      }
    })();

    if (decision.taskCount === 0) {
      decision.fail("Decider could not make any decisions!");
      console.warn(`Decider deciced to abort decision flow`);
    }

    //console.log(`Decider returning a decition:`, decision);
    return Promise.resolve(decision);

  } catch (err) {
    return Promise.reject(err);
  }

}
