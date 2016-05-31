
var testGetProfile = require('./feature-get-profile.js');
var testGetUnknownProfile = require('./error-unknown-profile.js');
var testEditProfile = require('./feature-edit-profile.js');

describe('profile-info', function () {

  var lambda = require('../../../profile/profile-info/handler.js');
  testGetProfile(lambda);
  testGetUnknownProfile(lambda);
});

describe('profile-edit', function () {

  var lambda = require('../../../profile/profile-edit/handler.js');
  testEditProfile(lambda);
});
