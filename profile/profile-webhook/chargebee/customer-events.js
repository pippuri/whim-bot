'use strict';


function handle(payload, key, defaultResponse) {
    console.log('handleCustomerEvents');
    switch (payload.event_type) {
      case 'customer_changed':
        console.log('\tcustomer_changed');
        console.log(payload);
        return defaultResponse;
      default:
        return defaultResponse;
    }
}

module.exports = {
  handle,
};
