var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var moment = require('moment');

module.exports = function() {
  var lambda = require('../../provider-taxi/provider-taxi-order/handler.js');

  describe('new order request', function () {
    var event = {
      "locations": [
        {
          "address": {
            "city": "Turku",
            "street_address": "Ratapihankatu 6"
          },
          "type": "pickup",
          "passenger_count": 1,
          "at": moment().add(6, 'hours').format(),
          "contacts": [
            {
              "provider_order_id": "MaaS-10001",
              "name": "Karl",
              "telephone": "+37256282689",
              "passenger_count": 1
            }
          ]
        },
        {
          "address": {
            "city": "Turku",
            "street_address": "Arvinkatu 8"
          },
          "type": "destination",
          "drop_off": [
            "MaaS-10001"
          ],
          "passenger_count": 1
        }
      ],
      "submitted": moment().format(),
      "prepaid": true
    };

    var error;
    var response;

    before(function (done) {
      wrap(lambda).run(event, function (err, data) {
        error = err;
        response = data;
        process.env.TAXI_ORDER_ID = response.order_id;
        done();
      });
    });

    it('should have succeeded', function () {
      expect(response.success).to.be.true;
    });

    it('should have returned an order id', function () {
      expect(response.order_id).to.not.be.undefined;
    });

  })
};