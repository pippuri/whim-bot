'use strict';

// Dependency
const lib = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError');
const SubscriptionMgr = require('../../lib/subscription-manager');

function getSingleProduct(event) {
  if (event.type === 'plan') {
    return SubscriptionMgr.getPlanById(event.id);
  } else if (event.type === 'addon') {
    return SubscriptionMgr.getAddonById(event.id);
  }

  return Promise.reject(new MaaSError('Invalid product type', 400));
}

module.exports.respond = function (event, callback) {
  getSingleProduct(event)
    .then(response => {
      if (event.type === 'plan') {
        callback(null, { plan: lib.parseSingleChargebeePlan(response) });
      } else if (event.type === 'addon') {
        callback(null, { addon: lib.parseSingleChargebeeAddon(response) });
      }
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error:', JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
