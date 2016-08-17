'use strict';

// Dependency
const Promise = require('bluebird');

// Library
const SubscriptionMgr = require('../../lib/subscription-manager');
const lib = require('../../lib/utils/index');

function getSingleProduct(event) {
  if (event.type === 'plan') {
    return SubscriptionMgr.getPlanById(event.id);
  } else if (event.type === 'addon') {
    return SubscriptionMgr.getAddonById(event.id);
  }

  return Promise.reject(new TypeError('Invalid product type'));
}

module.exports.respond = function (event, callback) {
  getSingleProduct(event)
    .then(response => {
      if (event.type === 'plan') {
        callback(null, lib.parseSingleChargebeePlan(response));
      } else if (event.type === 'addon') {
        callback(null, lib.parseSingleChargebeeAddon(response));
      }
    })
    .catch(error => {
      console.info('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn('Error: ' + error.message);
      callback(error);
    });
};
