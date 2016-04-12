var autocomplete = require('./feature-query.js');

describe('autocomplete provider',function(){

  describe('Google' , function(){
      this.timeout(20000);
      var lambda = require('../../provider-google/autocomplete/handler.js');
      autocomplete(lambda);
  });

  describe('HERE', function () {
    this.timeout(20000);
    var lambda = require('../../provider-here/autocomplete/handler.js');
    autocomplete(lambda);
  });


});