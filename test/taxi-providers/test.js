process.env.TAXI_ORDER_ID = null;

const testValidate = require('./feature-validate.js');
const testOrder = require('./feature-order.js');
const testGet = require('./feature-get.js');
const testCancel = require('./feature-cancel.js');

describe('taxi providers', function () {
  describe('Taxi', function () {
    testValidate();
    testOrder();
    testGet();
    testCancel();
  });
});
