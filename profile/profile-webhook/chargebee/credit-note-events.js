'use strict';


function handle(payload, key) {
  console.info('[Webhook][Chargebee] handleCreditNoteEvent (IGNORED)');
  console.info(JSON.stringify(payload));
  return Promise.resolve();
}

module.exports = {
  handle,
};
