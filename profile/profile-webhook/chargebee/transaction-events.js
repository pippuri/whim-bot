'use strict';


function handle(payload, key, defaultResponse) {
    console.info('handleTransactionEvents [IGNORED]');
    console.info(JSON.stringify(payload));
    return defaultResponse;
}

module.exports = {
  handle,
};
