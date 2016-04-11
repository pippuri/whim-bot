var autocomplete_google = require('./feature-google.js');
var autocomplete_here = require('./feature-here.js');

describe('Autocomplete provider',function(){

  describe('Google' , function(){
      this.timeout(20000);
      var lambda = require('../../provider-google/autocomplete/handler.js');
      autocomplete_google(lambda);
  });

  describe('HERE', function () {
    this.timeout(2000);
    var lambda = require('../../provider-here/autocomplete/handler.js');
    autocomplete_here(lambda);
  });


});