'use strict';


function handle(payload, key, defaultResponse) {
    console.log('handleSubscriptionEvents');
    return defaultResponse;
}

module.exports = {
  handle,
};
