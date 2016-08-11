
'use strict';

const moment = require('moment');
const MaaSError = require('../../lib/errors/MaaSError.js');
const Trip = require('./Trip');


/**
 * TripWorkFlow stores work flow process information. It helps to generate needed
 * SWF data structures, and handles serialization of flow related data, such as Trip.
 *
 */

const TripWorkFlow_STAGE = process.env.SERVERLESS_STAGE || 'dev';

const TripWorkFlow_DOMAIN = `maas-trip-stage-${TripWorkFlow_STAGE}`;
const TripWorkFlow_TASK_LIST_NAME = 'maas-trip';
const TripWorkFlow_TYPE_NAME = 'maas-trip';
const TripWorkFlow_TYPE_VERSION = 'test-v3';

const TripWorkFlow_TASK_NO_OPERATION = 'nop';
const TripWorkFlow_TASK_CHECK_BOOKING = 'check-booking';
const TripWorkFlow_TASK_START_TRIP = 'start-trip';
const TripWorkFlow_TASK_CLOSE_TRIP = 'close-trip';

module.exports = class TripWorkFlow {

  /**
   * Constructor validates work flow parameters. The object can be constructed without
   * ids or other properties, but they need to be then added later (e.g. via addTrip)
   *
   * @return {}
   */
  constructor(props) {
    this.coreFlowParams = Object.assign({}, {
      domain: TripWorkFlow_DOMAIN,
      taskList: {
        name: TripWorkFlow_TASK_LIST_NAME,
      },
      workflowType: {
        name: TripWorkFlow_TYPE_NAME,
        version: TripWorkFlow_TYPE_VERSION,
      },
      lambdaRole: process.env.iamRoleArnLambda
                  || 'arn:aws:iam::756207178743:role/MaaS-dev-r-IamRoleLambda-S27Y0PCCZ41I' // REMOVE!
                  || 'No role defined for AWS SWF to call lamdba functions!',
    }, props);
    //console.log("TripWorkFlow consturctor():", this)
  }

  /**
   * Assigns Trip object into the flow. If no Trip given, this method will fail.
   *
   * @return {}
   */
  addTrip(trip) {
    if (!trip || !(trip instanceof Trip)) {
      throw new MaaSError('Cannot create work flow without Trip', 400);
    }
    this.trip = trip;
    this.id = this.trip.reference;
    //console.log("TripWorkFlow addTrip():", this)
  }

  /**
   * Helper to check wether the object understands this kind of flows.
   *
   * @return {}
   */
  assertType(type) {
    return type.name === this.coreFlowParams.workflowType.name
           && type.version === this.coreFlowParams.workflowType.version;
  }

  /**
   * Deserialization method to construct data e.g. from SWF event input
   *
   * @return {}
   */
  assignEventInputData(input) {
    if (input.task && !input.task.name) {
      throw new MaaSError('Cannot assign flow input with task without name', 400);
    }
    this.trip = input.trip ? new Trip(input.trip) : this.trip;
    this.stage = input.stage || this.stage || TripWorkFlow_STAGE;
    this.task = input.task || this.task;
    //console.log("TripWorkFlow assignEventInputData():", this)
  }

  /**
   * Deserialization method to construct data e.g. from SWF decision task input.
   * This traveres through event history of workflow, and tries to get the lastest
   * meaningfull event, and try to extract flow information from input.
   *
   * Amazon offer proper SWF Framework for Java and Ruby, so this is therefore
   * very simple JavaScript version of those for this Trip tracking purpose.
   *
   * @return {}
   */
  assignDecisionTaskInput(data) {
    if (!this.assertType(data.workflowType)) {
      throw new Error(`assignDecisionTaskInput(): unknown decision task: '${this.data.workflowType}'`);
    }

    this.taskToken = data.taskToken;
    this.id = data.workflowExecution.workflowId;

    // because lint does not want to have loop inside loop
    function _startedEvents(events, results, type) {
      return events.filter(event => {
        return (event.eventId === results.startedEventId &&
                event.eventType === type);
      });
    }

    (() => {
      let results;
      let result;
      let startedEvents;
      for (const event of data.events) {
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
          case 'StartTimerFailed':
          case 'LambdaFunctionTimedOut':
          case 'ScheduleLambdaFunctionFailed':
          case 'StartLambdaFunctionFailed':
            console.warn(`assignDecisionTaskInput(): found ERROR event '${event.eventType}', ignoring...`);
            break;
          // events that we can handle
          case 'WorkflowExecutionSignaled':
            console.log('assignDecisionTaskInput(): found event \'WorkflowExecutionSignaled\'...');
            // ... TODO: check if trip being cancelled etc.
            this.event = event.eventType;
            return;
          case 'TimerFired':
            console.log('assignDecisionTaskInput(): found event \'TimerFired\'...');
            // looks like there has been activity task run, check results
            results = event.timerFiredEventAttributes;
            console.log('assignDecisionTaskInput(): found TimerFired results:', results);
            // since TimerFired does not carry input data for us, we need to
            // dig out it from the older event
            startedEvents = _startedEvents(data.events, results, 'TimerStarted');
            result = JSON.parse(startedEvents[0].timerStartedEventAttributes.control);
            this.assignEventInputData(result);
            this.event = event.eventType;
            return;
          case 'LambdaFunctionCompleted':
            console.log('assignDecisionTaskInput(): found event \'LambdaFunctionCompleted\'...');
            // looks like there has been activity task run, check results
            results = event.lambdaFunctionCompletedEventAttributes;
            console.log('assignDecisionTaskInput(): found LambdaFunction results:', results);
            result = JSON.parse(results.result);
            this.assignEventInputData(result.input);
            this.event = event.eventType;
            return;
          case 'LambdaFunctionFailed':
            console.log('assignDecisionTaskInput(): found event \'LambdaFunctionFailed\'...');
            // looks like there has been activity task run, check results
            results = event.lambdaFunctionFailedEventAttributes;
            console.log('assignDecisionTaskInput(): found LambdaFunctionFailed results:', results);
            // since LambdaFunctionFailed does not carry input data for us, we need to
            // dig out it from the event that started the lambda
            startedEvents = _startedEvents(data.events, results, 'LambdaFunctionScheduled');
            result = JSON.parse(startedEvents[0].lambdaFunctionScheduledEventAttributes.input);
            this.assignEventInputData(result);
            this.event = event.eventType;
            return;
          case 'WorkflowExecutionStarted':
            console.log('assignDecisionTaskInput(): found event \'WorkflowExecutionStarted\'...');
            result = event.workflowExecutionStartedEventAttributes
                     && event.workflowExecutionStartedEventAttributes.input
                     || '{}';
            this.assignEventInputData(JSON.parse(result));
            this.event = event.eventType;
            return;
          default:
            console.warn(`assignDecisionTaskInput(): found unknown event '${event.eventType}', ignoring...`);
            break;
        }
      }
    })();

  }

  //
  // Getters to return data structures to communicate with SWF.
  // Getters and setters to modify object.
  //

  get pollForDecisionTaskParams() {
    return Object.assign({}, {
      maximumPageSize: 30,                    // for now get max 30 events in reverse order
      reverseOrder: true,
    }, {
      domain: this.coreFlowParams.domain,
      taskList: this.coreFlowParams.taskList,
    });
  }

  get startWorkflowExecutionParams() {
    if (!this.trip) {
      throw new Error('TripWorkFlow startWorkflowExecutionParams requested without Trip');
    }
    // make last timeout roughly one hour after the trip is scheduled to end
    const executionStartToCloseTimeout = moment(this.trip.endTime).add(1, 'h');
    const tripFlowParams = Object.assign({}, this.coreFlowParams, {
      executionStartToCloseTimeout: executionStartToCloseTimeout.diff(moment(), 'seconds').toString(),
      input: JSON.stringify(this.flowInput),
    });
    //console.log("TripWorkFlow startWorkflowExecutionParams:", tripFlowParams);
    return tripFlowParams;
  }

  get id() {
    if (!this.coreFlowParams || !this.coreFlowParams.workflowId) {
      throw new Error('TripWorkFlow id requested; does not have one!');
    }
    return this.coreFlowParams.workflowId;
  }

  set id(id) {
    if (this.coreFlowParams.workflowId) {
      throw new Error('TripWorkFlow id already set; cannot change');
    }
    this.coreFlowParams.workflowId = id;
  }

  get taskToken() {
    if (!this.coreFlowParams.taskToken) {
      throw new Error('TripWorkFlow taskToken requested; does not have one!');
    }
    return this.coreFlowParams.taskToken;
  }

  set taskToken(token) {
    this.coreFlowParams.taskToken = token;
  }

  get flowInput() {
    return {
      trip: this.trip.toObject(),
      stage: this.stage || TripWorkFlow_STAGE,
      task: this.task,
    };
  }

  //
  // static getters to return constants
  //

  static get TASK_NO_OPERATION() {
    return TripWorkFlow_TASK_NO_OPERATION;
  }

  static get TASK_CHECK_BOOKING() {
    return TripWorkFlow_TASK_CHECK_BOOKING;
  }

  static get TASK_START_TRIP() {
    return TripWorkFlow_TASK_START_TRIP;
  }

  static get TASK_CLOSE_TRIP() {
    return TripWorkFlow_TASK_CLOSE_TRIP;
  }

};
