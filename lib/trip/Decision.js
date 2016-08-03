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

const Decision_StartTimerDecision = {
  decisionType: 'StartTimer',
  startTimerDecisionAttributes: {
    startToFireTimeout: 'STRING_VALUE', /* required */
    timerId: 'STRING_VALUE', /* required */
    control: 'STRING_VALUE'
  }
}

let Decision_DecisionHash = {
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

  scheduleTask(task) {
    let decision;
    switch (task) {
      case TripWorkFlow.TASK_CHECK_BOOKINGS:
        decision = Object.assign({}, Decision_ScheduleLambdaFunctionDecisionTemplate);
        decision.scheduleLambdaFunctionDecisionAttributes.id = this.flow.id;
        decision.scheduleLambdaFunctionDecisionAttributes.input = JSON.stringify({
          trip: this.flow.trip.toObject(),
          task: TripWorkFlow.TASK_CHECK_BOOKINGS,
          stage: this.flow.stage
        })
        this.decisions.push(decision);
        break;
      case TripWorkFlow.TASK_CLOSE_TRIP:
        decision = Object.assign({}, Decision_CompleteWorkflowExecutionTemplate);
        this.decisions.push(decision);
        break;
      default:
        throw new MaaSError(`Decision cannot create task for '${task}'`, 400);
        break;
    }
  }

  abortFlow(reason) {
    let decision = Object.assign({}, Decision_FailWorkflowExecutionTemplate);
    decision.failWorkflowExecutionDecisionAttributes.reason = reason || decision.failWorkflowExecutionDecisionAttributes.reason;
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
