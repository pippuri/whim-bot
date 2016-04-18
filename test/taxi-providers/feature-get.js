var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;

module.exports = function () {
  var lambda = require('../../provider-taxi/provider-taxi-get/handler.js');

  describe('get order status request', function () {
    var event = {
      id: 134
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
    
    it('should return at least one order status element', function () {
      expect(response.response.length).to.not.be.empty;
    });
  })
};