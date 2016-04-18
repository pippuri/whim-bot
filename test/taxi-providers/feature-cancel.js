var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;

module.exports = function () {
  var lambda = require('../../provider-taxi/provider-taxi-cancel/handler.js');
  
  describe('cancel order request', function () {
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
    
    it('should have been cancelled', function () {
      expect(response.cancelled).to.be.true;
    });
  })
};