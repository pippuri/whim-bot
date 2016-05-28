
var testCreateProfile = require('./feature-create-profile.js');
var testCreateDuplicateProfile = require('./error-profile-already-exists.js');

describe('profile-create', function () {

  var lambda = require('../../../profile/profile-create/handler.js');
  testCreateProfile(lambda);
  testCreateDuplicateProfile(lambda);

});
