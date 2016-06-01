
const testCreateProfile = require('./feature-create-profile.js');
const testCreateDuplicateProfile = require('./error-profile-already-exists.js');

describe('profile-create', function () {

  const lambda = require('../../../profile/profile-create/handler.js');
  testCreateProfile(lambda);
  testCreateDuplicateProfile(lambda);

});
