var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;

module.exports = function () {
  var lambda = require('../../provider-taxi/provider-taxi-get/handler.js');

  describe('get order status request', function () {
    var error;
    var response;

    before(function (done) {
      var event = {
        id: process.env.TAXI_ORDER_ID,
      };

      wrap(lambda).run(event, function (err, data) {
        error = err;
        response = data;
        done();
      });
    });

    it('should return at least one order status element', function () {
      expect(response.response.length).to.not.be.empty;
    });
  });
};
