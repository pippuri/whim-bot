'use strict';

// Library
const SubscriptionMgr = require('../../lib/subscription-manager');
const lib = require('../../lib/utilities/index');

function formatResponse(input) {

  const output = {
    plans: [],
    addons: [],
  };

  // Parse plans
  for (let i = 0; i < input[0].list.length; i++) {
    const planContext = input[0].list[i];
    if (planContext.plan.meta_data.hasOwnProperty('invisible')) {
      continue;
    }

    output.plans.push(lib.parseSingleChargebeePlan(planContext));
  }

  // Parse addons
  for (let j = 0; j < input[1].list.length; j++) {
    const addonContext = input[1].list[j];
    output.addons.push(lib.parseSingleChargebeeAddon(addonContext));
  }

  return output;
}

module.exports.respond = function (event, callback) {
  SubscriptionMgr.getProducts()
  .then(response => {
    callback(null, formatResponse(response));
  })
  .catch(error => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(error);
  });
};
