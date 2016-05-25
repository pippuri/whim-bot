
var testGetProfile = require('./feature-get-profile.js');
var testGetUnknownProfile = require('./error-unknown-profile.js');

describe('profile-info', function () {

  var lambda = require('../../../profile/profile-info/handler.js');
  testGetProfile(lambda);
  testGetUnknownProfile(lambda);

});
