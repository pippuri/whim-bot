'use strict';

const expect = require('chai').expect;
const Profile = require('../../../lib/business-objects/Profile');
const Transaction = require('../../../lib/business-objects/Transaction');

describe('Profile', () => {
  const testUserIdentity = 'eu-west-1:00000000-dead-dead-eaea-000000000000';
  const testUserPhone = '+358417556933';

  describe('_toSubscription', () => {
    const samplePlan = {
      plan: { id: 'fi-whim-light' },
      addons: ['fi-whim-hsl-helsinki'],
    };

    it('Converts features to agencyIds', () => {
      const converted = Profile._toSubscription(samplePlan);
      expect(converted.agencies).to.include('HSL');
    });
  });

  describe.skip('TODO create', () => {
    it('Creates a new profile for an user that already exists', () => {
      const transaction = new Transaction(testUserIdentity);

      return transaction.start()
        .then(() => {
          return Profile.create(testUserIdentity, testUserPhone, transaction)
            .then(
              profile => transaction.commit().then(() => profile),
              error => transaction.rollback().then(() => Promise.reject(error))
            );
        })
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
