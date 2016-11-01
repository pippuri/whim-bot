'use strict';

// Library
const MaaSError = require('../../lib/errors/MaaSError');
const SubscriptionMgr = require('../../lib/subscription-manager');

function formatResponse(input) {

  const output = {
    plans: [],
    addons: [],
  };

  // Parse plans
  for (let i = 0; i < input[0].list.length; i++) {
    const planContext = input[0].list[i];
    if (planContext.plan.meta_data.hasOwnProperty('invisible') ||
        (planContext.plan.hasOwnProperty('status') && planContext.plan.status !== 'active')) {
      continue;
    }

    output.plans.push(SubscriptionMgr.parseSingleChargebeePlan(planContext));
  }

  // Parse addons
  for (let j = 0; j < input[1].list.length; j++) {
    const addonContext = input[1].list[j];
    output.addons.push(SubscriptionMgr.parseSingleChargebeeAddon(addonContext));
  }

  return output;
}

module.exports.respond = function (event, callback) {
  SubscriptionMgr.getProducts()
  .then(response => {
    callback(null, formatResponse(response));
  })
  .catch(_error => {
    console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    // Uncaught, unexpected error
    if (_error instanceof MaaSError) {
      callback(_error);
      return;
    }

    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  });
};
