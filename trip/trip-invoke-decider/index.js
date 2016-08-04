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
function decider(data) {

  const flow = new TripWorkFlow();
  if (!flow.assertType(data.workflowType)) {
    return Promise.reject(new Error(`decider() got unknown decision task: '${data.workflowType}'`));
  }

  let lastEvent;

  //
  // First figure out past events and get the flow data out of it
  //

  try {
    flow.taskToken = data.taskToken;
    flow.id = data.workflowExecution.workflowId;

    (() => {
      let results, result, startedEvents;
      for (let event of data.events) {
        // return => all done, break => continue looping events
        switch (event.eventType) {
          // events that we don't care
          case 'WorkflowExecutionCompleted':
          case 'DecisionTaskStarted':
          case 'DecisionTaskScheduled':
          case 'DecisionTaskCompleted':
          case 'LambdaFunctionStarted':
          case 'LambdaFunctionScheduled':
          case 'TimerStarted':
          case 'TimerCanceled':
            break;
          // events that we should be worried about...
          case 'DecisionTaskTimedOut':
          case 'CompleteWorkflowExecutionFailed':
          case 'WorkflowExecutionFailed':
          case 'WorkflowExecutionTimedOut':
          case 'CancelWorkflowExecutionFailed':
          case 'WorkflowExecutionTerminated':
          case 'DecisionTaskTimedOut':
          case 'StartTimerFailed':
          case 'LambdaFunctionTimedOut':
          case 'ScheduleLambdaFunctionFailed':
          case 'StartLambdaFunctionFailed':
            console.warn(`Decider found ERROR event '${event.eventType}', ignoring...`);
            break;
          // events that we can handle
          case 'WorkflowExecutionSignaled':
            console.log(`Decider found event 'WorkflowExecutionSignaled'...`);
            // ... TODO: check if trip being cancelled etc.
            break;
          case 'TimerFired':
            console.log(`Decider found event 'TimerFired'...`);
            // looks like there has been activity task run, check results
            results = event.timerFiredEventAttributes;
            console.log(`Decider found TimerFired results:`, results);
            // since TimerFired does not carry input data for us, we need to
            // dig out it from the older event
            startedEvents = data.events.filter(function(event) {
              return (event.eventId === results.startedEventId &&
                      event.eventType === 'TimerStarted');
            })
            if (startedEvents.length !== 1) {
              throw new Error("TimerFired cloud not find out startedEvent to get input data!")
            }
            result = JSON.parse(startedEvents[0].timerStartedEventAttributes.control)
            flow.assignFlowInput(result);
            lastEvent = 'TimerFired';
            return;
          case 'LambdaFunctionCompleted':
            console.log(`Decider found event 'LambdaFunctionCompleted'...`);
            // looks like there has been activity task run, check results
            results = event.lambdaFunctionCompletedEventAttributes;
            console.log(`Decider found LambdaFunction results:`, results);
            result = JSON.parse(results.result);
            flow.assignFlowInput(result.input);
            lastEvent = 'LambdaFunctionCompleted';
            return;
          case 'LambdaFunctionFailed':
            console.log(`Decider found event 'LambdaFunctionFailed'...`);
            // looks like there has been activity task run, check results
            results = event.lambdaFunctionFailedEventAttributes;
            console.log(`Decider found LambdaFunctionFailed results:`, results);
            // since LambdaFunctionFailed does not carry input data for us, we need to
            // dig out it from the event that started the lambda
            startedEvents = data.events.filter(function(event) {
              return (event.eventId === results.scheduledEventId &&
                      event.eventType === 'LambdaFunctionScheduled');
            })
            if (startedEvents.length !== 1) {
              throw new Error("LambdaFunctionFailed cloud not find out startedEvent to get input data!")
            }
            result = JSON.parse(startedEvents[0].lambdaFunctionScheduledEventAttributes.input)
            flow.assignFlowInput(result);
            lastEvent = 'LambdaFunctionFailed';
            return;
          case 'WorkflowExecutionStarted':
            console.log(`Decider found event 'WorkflowExecutionStarted'...`);
            result = event.workflowExecutionStartedEventAttributes
                     && event.workflowExecutionStartedEventAttributes.input
                     || "{}";
            flow.assignFlowInput(JSON.parse(result));
            lastEvent = 'WorkflowExecutionStarted';
            return;
          default:
            console.warn(`Decider found unknown event '${event.eventType}', ignoring...`);
            break;
        }
      }
    })();
  } catch (err) {
    return Promise.reject(new Error(`Decider CRASHED while parsing events`, err));
  }

  //
  // Based on event and flow data, make a decision and send it to SWF
  //

  const decision = new Decision(flow);

  // generate a decision
  return new Promise((resolve, reject) => {
    // check did we understad the situation
    if (!lastEvent) {
      decision.abortFlow("Decider could not make any decisions!");
      console.warn(`Decider deciced to abort workflow, could not make any decisions`);
      return resolve(decision);
    }

    // check if somethings have failed
    if (lastEvent === 'LambdaFunctionFailed') {
      decision.abortFlow("LambdaFunctionFailed -- aborting...");
      console.warn(`Decider found that LambdaFunctionFailed -- aborting`);
      return resolve(decision);
    }

    // for now, always just fetch itinerary once, then close
    if (flow.trip.referenceType === 'itinerary') {
      let data = {
        identityId: flow.trip.identityId,
        itineraryId: flow.trip.referenceId,
        filter: ""
      }
      bus.call(LAMBDA_ITINERARY_RETRIEVE, data)
        .then(result => {
          console.log(`Decider checking itinerary...`, result);

          // ... find deffered leg/booking

          // lets next decision in one minute :)
          if (lastEvent === 'WorkflowExecutionStarted') {
            decision.scheduleTimer(Date.now() + 60000);
            console.log(`Decider decided to schedule timer into 60 seconds`);
          } else if (lastEvent === 'TimerFired') {
            decision.scheduleLambdaTask(LAMBDA_ITINERARY_UPDATE, {
              identityId: flow.trip.identityId,
              itineraryId: flow.trip.referenceId,
              payload: {
                state: "CANCELLED"
              }
            });
            console.log(`Decider decided to schedule lambda call`);
          } else if (lastEvent === 'LambdaFunctionCompleted') {
            decision.closeFlow();
            console.log(`Decider deciced to close trip`);
          }
          return resolve(decision);
        })
        .catch(err => {
          console.error("LAMBDA_ITINERARY_RETRIEVE fail")
          return reject(err);
        });
    } else {
      // everything else than itinerary..
      return resolve(decision);
    }
  })

  // then submit the decision
  .then((decision) => {
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
  })

}

module.exports.respond = function (event, callback) {
  return decider(event)
    .then((response) => callback(null, response))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};

