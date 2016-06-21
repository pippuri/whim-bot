'use strict';

const testGetProfile = require('./feature-get-profile.js');
const testGetUnknownProfile = require('./error-unknown-profile.js');
const testEditProfile = require('./feature-edit-profile.js');

describe('profile-info', function () {

  const lambda = require('../../../profile/profile-info/handler.js');
  testGetProfile(lambda);
  testGetUnknownProfile(lambda);
});

describe('profile-edit', function () {

  const lambda = require('../../../profile/profile-edit/handler.js');
  testEditProfile(lambda);
});