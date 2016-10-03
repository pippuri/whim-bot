'use strict';

const Promise = require('bluebird');
const Database = require('../lib/models/index').Database;
const validator = require('../lib/validator');
const schema = require('maas-schemas/prebuilt/maas-backend/business-rule-engine/request.json');
const maasOperation = require('../lib/maas-operation');

// Rules
const getProviderRules = require('./rules/get-provider');
const getRoutesRules = require('./rules/get-routes');
const getTspPricingRule = require('./rules/get-tsp-pricing');
const getPointsRules = require('./rules/get-points');

function runRule(event) {
  // Switch for non DB connection related rules and those that do
  switch (event.rule) {
    case 'get-provider':
    case 'get-provider-batch':
    case 'get-routes':
    case 'get-tsp-pricing':
    case 'get-tsp-pricing-batch':
      return Database.init()
        .then(() => {
          switch (event.rule) {
            case 'get-provider':
              return getProviderRules.getProvider(event.parameters);
            case 'get-provider-batch':
              return getProviderRules.getProviderBatch(event.parameters);
            case 'get-routes':
              return getRoutesRules.getRoutes(event.identityId, event.parameters);
            case 'get-tsp-pricing': // used to get contract rates from TSP
              return maasOperation.fetchCustomerProfile(event.identityId)
                .then(profile => getTspPricingRule.getOptions(event.parameters, profile));
            case 'get-tsp-pricing-batch': // used to get contract rates from TSP
              return maasOperation.fetchCustomerProfile(event.identityId)
                .then(profile => getTspPricingRule.getOptionsBatch(event.parameters, profile));
            default:
              return Promise.reject(new Error('Unsupported rule'));
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
      return Promise.reject(new Error('Unsupported rule'));
  }
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return validator.validate(schema, event)
    .then(() => runRule(event))
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      callback(_error);
    });
};
