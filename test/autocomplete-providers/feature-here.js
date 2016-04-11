var expect = require('chai').expect;
var wrap = require('lambda-wrapper').wrap;

module.exports = function(lambda){

  describe('autocomplete',function(){

    var event = {
      "hint": "latlon",
      "name": "Kamp",
      "lat": 60.1675800,
      "lon": 24.9302260,
      "count": 5,
      "radius": 5
    };

    var error;
    var response;

    before(function(done){
      wrap(lambda).run(event, function(err, data) {
          error = err;
          response = data;
          done();
      });
    });



    it('request parameter should contain query name', function(){
      expect(event).to.have.property('name').to.be.a('string');
    });
    it('request parameter should contain latitude',function(){
      expect(event).to.have.property('lat').to.be.a('number');
    });
    it('request parameter should contain longitude',function(){
      expect(event).to.have.property('lon').to.be.a('number');
    });
    it('request should be successful' , function(){
      expect(error).to.be.null;
    });
    it('response should have suggestions',function(){
      expect(response.suggestions).to.be.an('array');
    });
    it('response should have query object',function(){
      expect(response.query).to.be.an('object');
    });
    it('response query shoud contain api key',function(){
      expect(response.query['app_id']).to.not.be.undefined;
      expect(response.query['app_code']).to.not.be.undefined;
    });

  });

}