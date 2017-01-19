'use strict';

const Database = require('../lib/models/index').Database;
const Profile = require('../lib/business-objects/Profile');
const Promise = require('bluebird');
const schema = require('maas-schemas/prebuilt/maas-backend/business-rule-engine/request.json');
const validator = require('../lib/validator');
const MaaSError = require('../lib/errors/MaaSError');
const BusinessRuleError = require('../lib/errors/BusinessRuleError.js');

// Rules
const getBookingProviderRules = require('./rules/get-booking-provider');
const getTspPricingRule = require('./rules/get-tsp-pricing');
const getRoutePricingRule = require('./rules/get-route-pricing');

function runRule(event) {
  // Switch for non DB connection related bookingProviderRules and those that do
  switch (event.rule) {
    case 'get-booking-providers-by-agency-location':
    case 'get-booking-providers-by-mode-location':
    case 'get-tsp-pricing':
    case 'get-tsp-pricing-batch':
    case 'get-route-pricing':
      return Database.init()
        .then(() => {
          switch (event.rule) {
            case 'get-booking-providers-by-agency-location':
              return getBookingProviderRules.getBookingProvidersByAgencyAndLocation(event.parameters);
            case 'get-booking-providers-by-mode-location':
              return getBookingProviderRules.getBookingProvidersByModeAndLocation(event.parameters);
            case 'get-tsp-pricing': // used to get contract rates from TSP
              return Profile.retrieve(event.identityId)
                .then(profile => getTspPricingRule.getOptions(event.parameters, profile));
            case 'get-tsp-pricing-batch': // used to get contract rates from TSP
              return Profile.retrieve(event.identityId)
                .then(profile => getTspPricingRule.getOptionsBatch(event.parameters, profile));
            case 'get-route-pricing':
              return Profile.retrieve(event.identityId)
                .then(profile => getRoutePricingRule.resolveRoutesPrice(event.parameters, profile));
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
    default:
      return Promise.reject(new MaaSError('Unsupported rule ' + event.rule, 400));
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
