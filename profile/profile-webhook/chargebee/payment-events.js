'use strict';


function handle(payload, key, defaultResponse) {
    console.info('handlePaymentEvents [IGNORED]');
    console.info(JSON.stringify(payload));
    return defaultResponse;
}

module.exports = {
  handle,
};
