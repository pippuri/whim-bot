'use strict';


function handle(payload, key, defaultResponse) {
  console.info('[Webhook][Chargebee] handleCouponEvents (IGNORED)');
  console.info(JSON.stringify(payload));
  return defaultResponse;
}

module.exports = {
  handle,
};
