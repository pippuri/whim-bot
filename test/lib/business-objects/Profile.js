'use strict';

const expect = require('chai').expect;
const samplePlan = require('./chargebee-fi-whim-light.json');
const Profile = require('../../../lib/business-objects/Profile');

describe('Profile', () => {
  describe('_toSubscription', () => {
    it('Converts features to agencyIds', () => {
      const converted = Profile._toSubscription(samplePlan);
      expect(converted.agencies).to.include('HSL');
    });
  });
});
