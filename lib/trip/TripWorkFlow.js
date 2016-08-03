
'use strict';

const moment = require('moment');
const MaaSError = require('../../lib/errors/MaaSError.js');
const Trip = require('./Trip');


/**
 * TripWorkFlow stores work flow process information. It helps to generate needed
 * SWF data structures, and handles serialization of flow related data, such as Trip.
 *
 */

const TripWorkFlow_DOMAIN = `maas-trip-stage-${process.env.SERVERLESS_STAGE}`;
const TripWorkFlow_TASK_LIST_NAME = 'maas-trip';
const TripWorkFlow_TYPE_NAME = 'maas-trip';
const TripWorkFlow_TYPE_VERSION = 'test-v3';

const TripWorkFlow_TASK_NO_OPERATION = 'nop';
const TripWorkFlow_TASK_CHECK_BOOKINGS = 'check-bookings';
const TripWorkFlow_TASK_CLOSE_TRIP = 'close-trip';


module.exports = class TripWorkFlow {

  /**
   * Constructor validates work flow parameters. The object can be constructed without
   * ids or other properties, but they need to be then added later.
   *
   * @return {}
   */
  constructor(props) {
    this.coreFlowParams = Object.assign({}, {
      domain: TripWorkFlow_DOMAIN,
      taskList: {
        name: TripWorkFlow_TASK_LIST_NAME
      },
      workflowType: {
        name: TripWorkFlow_TYPE_NAME,
        version: TripWorkFlow_TYPE_VERSION
      },
      lambdaRole: process.env.iamRoleArnLambda
                  || 'arn:aws:iam::756207178743:role/MaaS-dev-r-IamRoleLambda-S27Y0PCCZ41I' // REMOVE!
                  || "No role defined for AWS SWF to call lamdba functions!"
    }, props);
    //console.log("TripWorkFlow consturctor():", this)
  }

  /**
   * Assigns Trip object into the flow. If no Trip given, this method will create one.
   *
   * @return {}
   */
  addTrip(trip) {
    if (!trip || !(trip instanceof Trip)) {
      throw new MaaSError(`Cannot create work flow without Trip`, 400);
    }
    this.trip = trip;
    this.id = this.trip.reference;
    //console.log("TripWorkFlow addTrip():", this)
  }

  /**
   * Deserialization method to construct data from SWF input event input field
   *
   * @return {}
   */
  assignFlowInput(input) {
    this.trip = input.trip ? new Trip(input.trip) : this.trip;
    this.stage = input.stage || this.stage;
    this.task = input.task || this.task;
    //console.log("TripWorkFlow assignFlowInput():", this)
  }

  /**
   * Helper to check wether the object understands this kind of flows.
   *
   * @return {}
   */
  assertType(type) {
    return type.name === this.coreFlowParams.workflowType.name
           && type.version === this.coreFlowParams.workflowType.version
  }

  //
  // Getters to return data structures to communicate with SWF.
  // Getters and setters to modify object.
  //

  get pollForDecisionTaskParams() {
    return Object.assign({}, {
      maximumPageSize: 10,                    // for now get only last ten events in reverse order
      reverseOrder: true
    }, {
      domain: this.coreFlowParams.domain,
      taskList: this.coreFlowParams.taskList
    })
  }

  get startWorkflowExecutionParams() {
    if (!this.trip) {
      throw new Error("TripWorkFlow startWorkflowExecutionParams requested without Trip");
    }
    // make last timeout roughly one hour after the trip is scheduled to end
    let executionStartToCloseTimeout = moment(this.trip.endTime).add(1, 'h');
    let tripFlowParams = Object.assign({}, this.coreFlowParams, {
      executionStartToCloseTimeout: executionStartToCloseTimeout.diff(moment(), 'seconds').toString(),
      input: JSON.stringify({
        trip: this.trip.toObject(),
        stage: this.stage || process.env.SERVERLESS_STAGE
      })
    })
    //console.log("TripWorkFlow startWorkflowExecutionParams:", tripFlowParams);
    return tripFlowParams;
  }

  get id() {
    if (!this.coreFlowParams || !this.coreFlowParams.workflowId) {
      throw new Error("TripWorkFlow id requested; does not have one!");
    }
    return this.coreFlowParams.workflowId;
  }

  set id(id) {
    if (this.coreFlowParams.workflowId) {
      throw new Error("TripWorkFlow id already set; cannot change");
    }
    this.coreFlowParams.workflowId = id;
  }

  get taskToken() {
    if (!this.coreFlowParams.taskToken) {
      throw new Error("TripWorkFlow taskToken requested; does not have one!");
    }
    return this.coreFlowParams.taskToken;
  }

  set taskToken(token) {
    this.coreFlowParams.taskToken = token;
  }

  set id(id) {
    this.coreFlowParams.workflowId = id;
  }

  get flowInput() {
    return {
      trip: this.trip.toObject(),
      stage: this.stage || process.env.SERVERLESS_STAGE,
      task: this.task
    };
  }

  //
  // static getters to return constants
  //

  static get TASK_NO_OPERATION() {
    return TripWorkFlow_TASK_NO_OPERATION;
  }

  static get TASK_CHECK_BOOKINGS() {
    return TripWorkFlow_TASK_CHECK_BOOKINGS;
  }

  static get TASK_CLOSE_TRIP() {
    return TripWorkFlow_TASK_CLOSE_TRIP;
  }


}

