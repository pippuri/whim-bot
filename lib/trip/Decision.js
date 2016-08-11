'use strict';

const MaaSError = require('../../lib/errors/MaaSError.js');
const TripWorkFlow = require('./TripWorkFlow');

/**
 * Decision is merely helper to construct SWF decision objects.
 *
 */

const Decision_ScheduleLambdaFunctionDecisionTemplate = {
  decisionType: 'ScheduleLambdaFunction',
  scheduleLambdaFunctionDecisionAttributes: {
    id: 'dummy',
    name: 'MaaS-trip-invoke-activity',
    input: '',
    startToCloseTimeout: '60',
  },
};

/* TODO the handler for cancelling the flow
const Decision_CancelWorkflowExecutionDecision = {
  decisionType: 'CancelWorkflowExecution',
  cancelWorkflowExecutionDecisionAttributes: {
    details: 'removing..'
  }
};
*/

const Decision_CompleteWorkflowExecutionTemplate = {
  decisionType: 'CompleteWorkflowExecution',
  completeWorkflowExecutionDecisionAttributes: {
    result: 'trip done!',
  },
};

const Decision_FailWorkflowExecutionTemplate = {
  decisionType: 'FailWorkflowExecution',
  failWorkflowExecutionDecisionAttributes: {
    reason: 'Decider did not know how to make decision!',
  },
};

const Decision_StartTimerDecisionTemplate = {
  decisionType: 'StartTimer',
  startTimerDecisionAttributes: {
    startToFireTimeout: 'STRING_VALUE',
    timerId: 'STRING_VALUE',
    control: 'STRING_VALUE',
  },
};

const Decision_DecisionHash = {
  taskToken: 'dummy',
  decisions: [],
  executionContext: 'no data',
};

module.exports = class Decision {

  constructor(flow) {
    if (!flow || !(flow instanceof TripWorkFlow)) {
      throw new MaaSError('Cannot create Decision without TripWorkFlow', 400);
    }
    this.flow = flow;
    this.decisions = [];
  }

 /**
  * Schedule lambda function execution. SWF always calls 'MaaS-trip-invoke-activity'
  * lambda that then invokes actual lambda (serviceName).
  * @param {String} serviceName Name of the lambda function to run.
  * @param {Object} event Paramters for the lambda function
  */
  scheduleLambdaTask(serviceName, event) {
    const decision = JSON.parse(JSON.stringify(Decision_ScheduleLambdaFunctionDecisionTemplate));
    decision.scheduleLambdaFunctionDecisionAttributes.id = this.flow.id;
    const flowInput = this.flow.flowInput;
    flowInput.task = {
      name: serviceName,
      params: event,
    };
    decision.scheduleLambdaFunctionDecisionAttributes.input = JSON.stringify(flowInput);
    this.decisions.push(decision);
  }

  /**
   * Schedule decider to run in some point of furere.
   * @param {Number} time (Unix timestamp) when timer should fire
   */
  scheduleTimedTask(firedTime, taskName, taskParams) {
    const decision = JSON.parse(JSON.stringify(Decision_StartTimerDecisionTemplate));
    decision.startTimerDecisionAttributes.timerId = `${this.flow.id}-${taskName}-${firedTime}`;
    decision.startTimerDecisionAttributes.startToFireTimeout = Math.round((firedTime - Date.now()) / 1000).toString();
    const flowInput = this.flow.flowInput;
    flowInput.task = {
      name: taskName,
      params: taskParams,
    };
    decision.startTimerDecisionAttributes.control = JSON.stringify(flowInput);
    this.decisions.push(decision);
  }

  /**
   * Make workflow abort decision.
   * @param {String} reason
   */
  abortFlow(reason) {
    const decision = JSON.parse(JSON.stringify(Decision_FailWorkflowExecutionTemplate));
    decision.failWorkflowExecutionDecisionAttributes.reason = reason || decision.failWorkflowExecutionDecisionAttributes.reason;
    this.decisions.push(decision);
  }

  /**
   * Make workflow closing decision.
   */
  closeFlow() {
    const decision = JSON.parse(JSON.stringify(Decision_CompleteWorkflowExecutionTemplate));
    this.decisions.push(decision);
  }

  /**
   * Getter to give parameters for decisionTaskCompleted SWF call
   */
  get decisionTaskCompletedParams() {
    const params = Object.assign({}, Decision_DecisionHash);
    params.taskToken = this.flow.taskToken;
    params.decisions = this.decisions;
    //console.log("Decision decisionTaskCompletedParams:", params);
    return params;
  }

  /**
   * Getter to get current count of decisions
   */
  get taskCount() {
    return this.decisions.length;
  }

};
