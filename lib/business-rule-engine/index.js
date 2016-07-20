'use strict';

const defaultServiceBus = require('../../lib/service-bus/index.js');

const Promise = require('bluebird');
const _case = require('case-expression');
const _default = () => true;

// rules
const getPointsRule = require('./rules/get-points.js');
const convertToPointsRule = require('./rules/convert-to-points.js');
const getRoutesRule = require('./rules/get-routes.js');

function callGetRoutes(serviceBus, ruleObject) {
  return getRoutesRule.getRoutes(serviceBus, ruleObject.identityId, ruleObject.parameters);
}

function callGetPoints(serviceBus, ruleObject) {
  return getPointsRule.getPoints(serviceBus, ruleObject.identityId, ruleObject.parameters);
}

function callConvertToPoints(serviceBus, ruleObject) {
  return convertToPointsRule.convertToPoints(serviceBus, ruleObject.identityId, ruleObject.parameters);
}

function call(ruleObject, options) {
  let serviceBus;

  if (typeof options === typeof {} && typeof options.serviceBus === typeof defaultServiceBus) {
    serviceBus = options.serviceBus;
  } else {
    serviceBus = defaultServiceBus;
  }

  return _case(ruleObject.rule, [

    /**
     * ruleObject.parameters
     * @param {String} from - from lat + lon
     * @param {String} to - to lat + lon
     * @param {String} leaveAt
     * @param {String} arriveBy
     */
    'get-routes', () => {
      return callGetRoutes(serviceBus, ruleObject);
    },

    /**
     * {ruleObject.parameters} - Get point if buy from agencyId
     * @param {String} agencyId
     * @return {Int} point
     */
    'get-points', () => {
      return callGetPoints(serviceBus, ruleObject);
    },

    /**
     * {ruleObject.parameters} - Convert money to points with conversion rate
     * @param {String} agencyId
     * @param {String} price
     * @param {String} currency
     * @return {Int} point
     * TODO start working on point conversion
     */
    'convert-to-points', () => {
      return callConvertToPoints(serviceBus, ruleObject);
    },

    _default, () => {
      return Promise.reject(new Error('unknown rule ' + ruleObject.rule));
    },

  ]);

}

module.exports = {
  call: call,
};
