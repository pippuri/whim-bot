'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const TripWorkFlow = require('../../lib/trip/TripWorkFlow');
const Decision = require('../../lib/trip/Decision');

const swfClient = new AWS.SWF({ region: process.env.AWS_REGION });
Promise.promisifyAll(swfClient);

/**
 * Decider
 *
 * @return {Promise -> Decision} Decision object containing needed data to repond SWF.
 */
function decider(data) {

  const flow = new TripWorkFlow();
  if (!flow.assertType(data.workflowType)) {
    return Promise.reject(new Error(`decider() got unknown decision task: '${data.workflowType}'`));
  }

  try {
    flow.taskToken = data.taskToken;
    flow.id = data.workflowExecution.workflowId;

    const decision = new Decision(flow);

    // traverse event history until we know what to do
    // return == all done, break == continue looping events
    (() => {
      for (let event of data.events) {
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
            decision.scheduleTask(TripWorkFlow.TASK_CLOSE_TRIP);
            console.log(`Decider deciced to schedule task '${TripWorkFlow.TASK_CLOSE_TRIP}'`);
            return;
          case 'WorkflowExecutionStarted':
            console.log(`Decider processing past event 'WorkflowExecutionStarted'...`);
            let input = event.workflowExecutionStartedEventAttributes
                        && event.workflowExecutionStartedEventAttributes.input
                        || "{}";
            flow.assignFlowInput(JSON.parse(input));
            if (flow.trip.referenceType === 'itinerary') {
              decision.scheduleTask(TripWorkFlow.TASK_CHECK_BOOKINGS);
              console.log(`Decider decided to schedule task '${TripWorkFlow.TASK_CHECK_BOOKINGS}'`);
            }
            return;
          default:
            console.warn(`Decider found unknown event '${event.eventType}', ignoring...`);
            break;
        }
      }
    })();

    if (decision.taskCount === 0) {
      decision.abortFlow("Decider could not make any decisions!");
      console.warn(`Decider deciced to abort workflow, could not make any decisions`);
    }

    // send decision to SWF
    return swfClient.respondDecisionTaskCompletedAsync(decision.decisionTaskCompletedParams)
      .then(data => {
        console.log(`Decider done with workflowId '${flow.id}'`);
        return Promise.resolve({ workFlowId: flow.id });
      })
      .catch(err => {
        console.error(`Decider responding decision for workflowId FAILED '${flow.id}'`, err);
        return Promise.reject(err);
      });

  } catch (err) {
    console.error(`Decider CRASHED `, err);
    return Promise.reject(err);
  }

}

module.exports.respond = function (event, callback) {
  return decider(event)
    .then((response) => callback(null, response))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};

