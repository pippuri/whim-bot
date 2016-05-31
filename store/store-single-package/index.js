// Dependency
var Promise = require('bluebird');

// Library
var SubscriptionMgr = require('../../lib/subscription-manager');
var lib = require('../../lib/utilities/index');

function getSingleProduct(event) {
  if (event.type === 'plan') {
    return SubscriptionMgr.getPlanById(event.id);
  } else if (event.type === 'addon') {
    return SubscriptionMgr.getAddonById(event.id);
  } else {
    return Promise.reject(new TypeError('Invalid product type'));
  }
}

module.exports.respond = function (event, callback) {
  getSingleProduct(event)
    .then(function (response) {
      if (event.type === 'plan') {
        callback(null, lib.parseSingleChargebeePlan(response));
      } else if (event.type === 'addon') {
        callback(null, lib.parseSingleChargebeeAddon(response));
      }
    })
    .catch(function (error) {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn('Error: ' + error.message);
      callback(error);
    });
};
