'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-payment-put/handler.js');

module.exports = function () {

  describe('profile-card-update', () => {
    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    const event = {
      identityId: identityId,
      payload: {
        firstName: 'Test',
        lastName: 'User',
        email: 'abcd@gmail.com',
        phone: '+35810983012',
        address: 'Varputie 17, 02270 Espoo',
        zip: '02270',
        city: 'Espoo',
        country: 'Finland',
        type: 'stripe-token',
        token: 'egroegoiegioehoiheaoghae',
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

    it('should return empty', () => {
      expect(response).to.deep.equal({});
    });
  });
};
