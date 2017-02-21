'use strict';

// Module to wrap the routes provider lambda wrapper into biz engine to decrease execution time
// Reason: Lambda call through bus are costly.

const digitransitRoutes = require('../../providers/provider-digitransit-routes');
const hereRoutes = require('../../providers/provider-here-routes');
const tripgoRoutes = require('../../providers/provider-tripgo-routes');
const valopilkkuRoutes = require('../../providers/provider-valopilkku-routes');
const MaaSError = require('../../../lib/errors/MaaSError');

const mapping = {
  'MaaS-provider-digitransit-routes': digitransitRoutes,
  'MaaS-provider-here-routes': hereRoutes,
  'MaaS-provider-tripgo-routes': tripgoRoutes,
  'MaaS-provider-valopilkku-routes': valopilkkuRoutes,
};

function wrap(lambdaName, event) {
  const now = Date.now();

  if (!mapping[lambdaName]) {
    return Promise.reject(new MaaSError(`No mapping found for ${lambdaName}`, 500));
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
