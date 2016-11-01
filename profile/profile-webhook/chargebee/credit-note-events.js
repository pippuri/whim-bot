'use strict';


function handle(payload, key, defaultResponse) {
  console.info('handleCreditNoteEvent [IGNORED]');
  console.info(JSON.stringify(payload));
  return defaultResponse;
}

module.exports = {
  handle,
};
