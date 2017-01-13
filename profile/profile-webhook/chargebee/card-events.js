'use strict';

function handle(payload, key) {
  console.info(`[Webhook][Chargebee] handleCardEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));
  return Promise.resolve();
}

module.exports = {
  handle,
};
