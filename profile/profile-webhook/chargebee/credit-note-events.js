'use strict';


function handle(payload, key, defaultResponse) {
    console.log('handleCreditNoteEvent [IGNORED]');
    return defaultResponse;
}

module.exports = {
  handle,
};
