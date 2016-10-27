'use strict';


function handle(payload, key, defaultResponse) {
    console.log('handleTransactionEvents [IGNORED]');
    return defaultResponse;
}

module.exports = {
  handle,
};
