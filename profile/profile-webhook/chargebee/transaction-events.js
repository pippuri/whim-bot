'use strict';


function handle(payload, key, defaultResponse) {
  console.info('[Webhook][Chargebee] handleTransactionEvents (IGNORED)');
  console.info(JSON.stringify(payload));
  return defaultResponse;
}

module.exports = {
  handle,
};
