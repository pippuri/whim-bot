var testReverseGeocoding = require('./feature-reverse-geocoding.js');

describe('reverse geocoding endpoint', function () {
  this.timeout(20000);

  var lambda = require('../../../geocoding/reverse-geocoding-query/handler.js');
  testReverseGeocoding(lambda);
});
