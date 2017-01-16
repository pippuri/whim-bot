'use strict';

const Database = require('../../../lib/models/Database');
const expect = require('chai').expect;
const bus = require('../../../lib/service-bus');
const MaaSError = require('../../../lib/errors/MaaSError');
const Profile = require('../../../lib/business-objects/Profile');
const wrap = require('lambda-wrapper').wrap;

module.exports = function (identityId) {

  describe('profile-top-up-invalid-limit', () => {
    const event = {
      identityId: identityId,
      payload: {
        productId: 'fi-whim-points-purchase-payg',
        amount: '500',
        chargeOK: '100',
      },
    };

    let error;

    before(done => {
      return bus.call('MaaS-profile-top-up', event)
        .then(
          result => result,
          err => (error = err)
        );
    });

    it('should raise an error', () => {
      expect(error).to.be.instanceof(MaaSError);
      expect(error.code).to.equal(403);
    });
  });

  describe('profile-top-up-ok', () => {
    const topUpAmount = 500;
    const event = {
      identityId: identityId,
      payload: {
        productId: 'fi-whim-points-purchase-payg',
        amount: `${topUpAmount}`,
        chargeOK: '2500',
      },
    };

    let error;
    let response;
    let oldBalance;

    before(done => {
      // Initialize a profile that can be topped up
      Database.init()
        .then(() => Profile.retrieve(event.identityId))
        .then(profile => {
          oldBalance = profile.balance;
          wrap(lambda).run(event, (err, data) => {
            error = err;
            response = data;

            done();
          });
        });
    });

    after(() => {
      return Database.cleanup();
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should return a profile', () => {
      expect(response).to.have.property('profile');
    });

    it('should have a correct new balance', () => {
      expect(response.profile.balance).to.equal(oldBalance + topUpAmount);
    });
  });
};
