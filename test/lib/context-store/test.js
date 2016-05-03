
var testGetProfile = require('./feature-get-profile.js');
var testGetUnknownProfile = require('./feature-get-unknown-profile.js');

describe('context store', function () {

  var store = require('../../../lib/context-store/store.js');
  testGetProfile(store);
  testGetUnknownProfile(store);

});
