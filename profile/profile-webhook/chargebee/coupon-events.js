'use strict';


function handle(payload, key) {
  console.info('[Webhook][Chargebee] handleCouponEvents (IGNORED)');
  console.info(JSON.stringify(payload));
}

module.exports = {
  handle,
};
