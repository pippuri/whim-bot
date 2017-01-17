'use strict';


function handle(payload, key, defaultResponse) {
  console.info('[Webhook][Chargebee] handlePlanEvents (IGNORED)');
  console.info(JSON.stringify(payload));
  return defaultResponse;
}

module.exports = {
  handle,
};
