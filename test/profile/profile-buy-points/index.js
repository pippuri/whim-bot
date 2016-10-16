'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-top-up/handler.js');
const Profile = require('../../../lib/business-objects/Profile');

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
      wrap(lambda).run(event, (err, data) => {
        error = err;
        done();
      });
    });

    it('should raise an error', () => {
      expect(error).to.be.instanceof(Error);
      expect(error.code).to.equal(403);
    });
  });

  describe('profile-top-up-ok', function () { //eslint-disable-line
    this.timeout(10000);
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
      Profile.retrieve(event.identityId)
        .then(profile => {
          oldBalance = profile.balance;
          wrap(lambda).run(event, (err, data) => {
            error = err;
            response = data;
            done();
          });
        });
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
