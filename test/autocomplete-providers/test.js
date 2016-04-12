var testAutocomplete = require('./feature-query.js');

describe('autocomplete provider',function(){

  describe('Google places' , function(){
      this.timeout(20000);
      var lambda = require('../../provider-google/autocomplete/handler.js');
      testAutocomplete(lambda);
  });

  describe('HERE suggest', function () {
    this.timeout(20000);
    var lambda = require('../../provider-here/autocomplete/handler.js');
    testAutocomplete(lambda);
  });


});
