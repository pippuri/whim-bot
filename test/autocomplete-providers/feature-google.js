var expect = require('chai').expect;
var wrap = require('lambda-wrapper').wrap;

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
    it('should contain autocomplete list', function(){
      expect(event).to.have.property('name').to.be.a('string');
    });
    it('response should have suggestions',function(){
      expect(response.suggestions).to.be.an('array');
    });
    it('response should have query object',function(){
      expect(response.query).to.be.an('object');
    });
    it('response query shoud contain api key',function(){
      expect(response.query['key']).to.not.be.undefined;
    });

  });

}