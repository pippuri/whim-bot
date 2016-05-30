// Dependency
var Promise = require('bluebird');

// Library
var SubscriptionMgr = require('../../lib/subscription-manager');

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
      callback(null, response);
    })
    .catch(function (error) {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn('Error: ' + error.message);
      callback(error);
    });
};
