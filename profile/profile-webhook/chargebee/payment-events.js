'use strict';


function handle(payload, key, defaultResponse) {
    console.log('handlePaymentEvents [IGNORED]');
    return defaultResponse;
}

module.exports = {
  handle,
};
