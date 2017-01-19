'use strict';

// Module to wrap the routes provider lambda wrapper into biz engine to decrease execution time
// Reason: Lambda call through bus are costly.
const Promise = require('bluebird');

const digitransitRoutes = require('../../providers/provider-digitransit-routes');
const hereRoutes = require('../../providers/provider-here-routes');
const tripgoRoutes = require('../../providers/provider-tripgo-routes');
const valopilkkuRoutes = require('../../providers/provider-valopilkku-routes');
const storeSinglePackage = require('../../../store/store-single-package');

const mapping = {
  'MaaS-provider-digitransit-routes': digitransitRoutes,
  'MaaS-provider-here-routes': hereRoutes,
  'MaaS-provider-tripgo-routes': tripgoRoutes,
  'MaaS-provider-valopilkku-routes': valopilkkuRoutes,
  'MaaS-store-single-package': storeSinglePackage,
};

function wrap(lambdaName, event) {
  const now = Date.now();

  if (!mapping[lambdaName]) {
    return Promise.reject(new Error(`No mapping found for ${lambdaName}`));
  }

  return new Promise((resolve, reject) => {
    mapping[lambdaName].respond(event, (error, response) => {
      if (error) {
        console.info(`${lambdaName} failed for ${event.modes}`, Date.now() - now);
        return reject(error);
      }

      console.info(`${lambdaName} succeeded for ${event.modes}, received ${response.plan.itineraries.length} itineraries, took ${Date.now() - now} millis`);
      return resolve(response);
    });
  });
}

// Lambda Handler
module.exports = {
  wrap,
};