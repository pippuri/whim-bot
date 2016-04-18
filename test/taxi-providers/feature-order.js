var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;

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
          "at": "2016-04-18T16:30:00+03:00",
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
      "submitted": "2016-04-18T10:12:51+03:00",
      "prepaid": true
    };

    var error;
    var response;

    before(function (done) {
      wrap(lambda).run(event, function (err, data) {
        error = err;
        response = data;
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