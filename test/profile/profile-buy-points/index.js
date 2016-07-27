'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-top-up/handler.js');

module.exports = function () {

  describe('profile-top-up', () => {
    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    const event = {
      identityId: identityId,
      payload: {
        productId: 'fi-whim-points-purchase-payg',
        amount: '500',
        chargeOK: '2500',
      },
    };

    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        if (err) {
          console.log('Error', err);
        }
        done();
      });
    });

    it('should not raise an error', () => {
      expect(error).to.be.null;
    });

    it('should return an updated profile', () => {
      expect(response).to.have.deep.property('profile.balance');
    });
  });
};
