var expect = require('chai').expect;
var wrap = require('lambda-wrapper').wrap;

var validator = require('./response_validator');

module.exports = function(lambda){

  describe('autocomplete',function(){

    var event = {
      "hint": "latlon",
      "name": "Kamppi",
      "count": 5,
      "lat": 60.1675800,
      "lon": 24.9302260,
      "radius": 5
    };

    var error;
    var response;

    before(function(done){
      wrap(lambda).run(event,function(err, data){
          error = err;
          response = data;
          done();
      });
    });

    it('request should be successful' , function(){
      expect(error).to.be.null;
    });
  
    it('should give a valid response', function () {
      var validation_error = validator(response);
      expect(validation_error).to.be.null;
    });

  });

}
