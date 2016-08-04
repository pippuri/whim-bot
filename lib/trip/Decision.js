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
    startToCloseTimeout: '60'
  }
};

const Decision_CancelWorkflowExecutionDecision = {
  decisionType: 'CancelWorkflowExecution',
  cancelWorkflowExecutionDecisionAttributes: {
    details: 'removing..'
  }
};

const Decision_CompleteWorkflowExecutionTemplate = {
  decisionType: 'CompleteWorkflowExecution',
  completeWorkflowExecutionDecisionAttributes: {
    result: 'trip done!'
  }
};

const Decision_FailWorkflowExecutionTemplate = {
  decisionType: 'FailWorkflowExecution',
  failWorkflowExecutionDecisionAttributes: {
    reason: 'Decider did not know how to make decision!'
  }
};

const Decision_StartTimerDecisionTemplate = {
  decisionType: 'StartTimer',
  startTimerDecisionAttributes: {
    startToFireTimeout: 'STRING_VALUE',
    timerId: 'STRING_VALUE',
    control: 'STRING_VALUE'
  }
}

const Decision_DecisionHash = {
  taskToken: 'dummy',
  decisions: [],
  executionContext: 'no data'
};

module.exports = class Decision {

  constructor(flow) {
    if (!flow || !(flow instanceof TripWorkFlow)) {
      throw new MaaSError(`Cannot create Decision without TripWorkFlow`, 400);
    }
    this.flow = flow;
    this.decisions = [];
  }

  scheduleLambdaTask(serviceName, event) {
    let decision = Object.assign({}, Decision_ScheduleLambdaFunctionDecisionTemplate);
    decision.scheduleLambdaFunctionDecisionAttributes.id = this.flow.id;
    decision.scheduleLambdaFunctionDecisionAttributes.input = JSON.stringify({
      trip: this.flow.trip.toObject(),
      task: {
        serviceName: serviceName,
        event: event
      },
      stage: this.flow.stage
    });
    this.decisions.push(decision);
  }

  /**
  * Schedule decider to run in some point of furere.
  * @param {Number} time (Unix timestamp) when timer should fire
  */
  scheduleTimer(firedTime) {
    let decision = Object.assign({}, Decision_StartTimerDecisionTemplate);
    decision.startTimerDecisionAttributes.timerId = this.flow.id;
    decision.startTimerDecisionAttributes.startToFireTimeout = Math.round((firedTime - Date.now()) / 1000).toString();
    decision.startTimerDecisionAttributes.control = JSON.stringify({
      trip: this.flow.trip.toObject(),
      stage: this.flow.stage
    })
    this.decisions.push(decision);
  }

  abortFlow(reason) {
    let decision = Object.assign({}, Decision_FailWorkflowExecutionTemplate);
    decision.failWorkflowExecutionDecisionAttributes.reason = reason || decision.failWorkflowExecutionDecisionAttributes.reason;
    this.decisions.push(decision);
  }

  closeFlow() {
    let decision = Object.assign({}, Decision_CompleteWorkflowExecutionTemplate);
    this.decisions.push(decision);
  }

  get decisionTaskCompletedParams() {
    let params = Object.assign({}, Decision_DecisionHash);
    params.taskToken = this.flow.taskToken;
    params.decisions = this.decisions;
    //console.log("Decision decisionTaskCompletedParams:", params);
    return params;
  }

  get taskCount() {
    return this.decisions.length;
  }

}
