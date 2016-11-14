'use strict';

const Database = require('../lib/models/index').Database;
const Profile = require('../lib/business-objects/Profile');
const Promise = require('bluebird');
const schema = require('maas-schemas/prebuilt/maas-backend/business-rule-engine/request.json');
const validator = require('../lib/validator');
const MaaSError = require('../lib/errors/MaaSError');
const BusinessRuleError = require('../lib/errors/BusinessRuleError.js');

// Rules
const getProviderRules = require('./rules/get-provider');
const getRoutesRules = require('./rules/get-routes');
const getTspPricingRule = require('./rules/get-tsp-pricing');
const getPointsRules = require('./rules/get-points');

function runRule(event) {
  // Switch for non DB connection related rules and those that do
  switch (event.rule) {
    case 'get-booking-provider':
    case 'get-booking-provider-batch':
    case 'get-routes-provider':
    case 'get-routes-provider-batch':
    case 'get-routes':
    case 'get-tsp-pricing':
    case 'get-tsp-pricing-batch':
      return Database.init()
        .then(() => {
          switch (event.rule) {
            case 'get-booking-provider':
              return getProviderRules.getBookingProvider(event.parameters);
            case 'get-routes-provider':
              return getProviderRules.getRoutesProvider(event.parameters);
            case 'get-booking-provider-batch':
              return getProviderRules.getBookingProvidersBatch(event.parameters);
            case 'get-routes-provider-batch':
              return getProviderRules.getRoutesProvidersBatch(event.parameters);
            case 'get-routes':
              return getRoutesRules.getRoutes(event.identityId, event.parameters);
            case 'get-tsp-pricing': // used to get contract rates from TSP
              return Profile.retrieve(event.identityId)
                .then(profile => getTspPricingRule.getOptions(event.parameters, profile));
            case 'get-tsp-pricing-batch': // used to get contract rates from TSP
              return Profile.retrieve(event.identityId)
                .then(profile => getTspPricingRule.getOptionsBatch(event.parameters, profile));
            default:
              return Promise.reject(new MaaSError('Unsupported rule ' + event.rule, 400));
          }
        })
        .then(response =>  Database.cleanup().then(() => Promise.resolve(response)))
        .catch(error => {
          return Database.cleanup()
            .catch(_error => (error = _error))
            .then(() => {
              return Promise.reject(error);
            });
        });
    case 'get-point-pricing':
      return getPointsRules.getPointPricing(event.identityId, event.parameters);
    case 'get-point-pricing-batch':
      return getPointsRules.getPointBatch(event.identityId, event.parameters);
    default:
      return Promise.reject(new MaaSError('Unsupported rule ' + event.rule, 400));
  }
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  console.info(event);
  return validator.validate(schema, event)
    .then(() => runRule(event))
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      if (_error instanceof BusinessRuleError) {
        callback(_error);
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
