var testValidate = require('./feature-validate.js');
var testOrder = require('./feature-order.js');
var testGet = require('./feature-get.js');
var testCancel = require('./feature-cancel.js');

describe('taxi providers', function() {
  describe('Taxi', function () {

    testValidate();
    testOrder();
    testGet();
    testCancel();
  })
});