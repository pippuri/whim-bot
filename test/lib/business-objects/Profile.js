'use strict';

const expect = require('chai').expect;
const samplePlan = require('./chargebee-fi-whim-light.json');
const Profile = require('../../../lib/business-objects/Profile');

describe('Profile', () => {
  const testUserIdentity = 'eu-west-1:00000000-dead-dead-eaea-000000000000';
  const testUserPhone = '+358417556933';

  describe('_toSubscription', () => {
    it('Converts features to agencyIds', () => {
      const converted = Profile._toSubscription(samplePlan);
      expect(converted.agencies).to.include('HSL');
    });
  });

  describe.skip('TODO create', () => {
    it('Creates a new profile for an user that alraedy exists', () => {
      return Profile.create(testUserIdentity, testUserPhone)
        .then(profile => {
          return profile;
        })
        .catch(error => {
          console.log('Caught an error', error.message);
          console.log(JSON.stringify(error, null, 2));
          console.log(error.stack);
        });
    });
  });
});
