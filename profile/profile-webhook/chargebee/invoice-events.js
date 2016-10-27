'use strict';


function handle(payload, key, defaultResponse) {
    console.log('handleInvoiceEvents [IGNORED]');
    return defaultResponse;
}

module.exports = {
  handle,
};
