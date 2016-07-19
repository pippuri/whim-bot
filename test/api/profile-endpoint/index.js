'use strict';

const testGetProfile = require('./feature-get-profile.js');
const testGetUnknownProfile = require('./error-unknown-profile.js');
const testEditProfile = require('./feature-edit-profile.js');
const testCreateExistedProfile = require('./error-profile-already-exists.js');
const testCreateProfile = require('./feature-create-profile.js');

describe('profile-info', () => {

  const lambda = require('../../../profile/profile-info/handler.js');
  testGetProfile(lambda);
  testGetUnknownProfile(lambda);
});

describe('profile-edit', () => {

  const lambda = require('../../../profile/profile-edit/handler.js');
  testEditProfile(lambda);
});

describe('profile-create', () => {
  const lambda = require('../../../profile/profile-create/handler.js');
  testCreateExistedProfile(lambda);
  testCreateProfile(lambda);
});
