'use strict';

// Library
var SubscriptionMgr = require('../../lib/subscription-manager');
var lib = require('../../lib/utilities/index');

function formatResponse(input) {

  var output = {
    plans: [],
    addons: [],
  };

  // Parse plans
  for (var i = 0; i < input[0].list.length; i++) {
    var planContext = input[0].list[i];
    if (planContext.plan.meta_data.hasOwnProperty('invisible')) {
      continue;
    }

    output.plans.push(lib.parseSingleChargebeePlan(planContext));
  }

  // Parse addons
  for (var j = 0; j < input[1].list.length; j++) {
    var addonContext = input[1].list[j];
    output.addons.push(lib.parseSingleChargebeeAddon(addonContext));
  }

  return output;
}

module.exports.respond = function (event, callback) {
  SubscriptionMgr.getProducts()
  .then(function (response) {
    callback(null, formatResponse(response));
  })
  .catch(function (error) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(error);
  });
};
