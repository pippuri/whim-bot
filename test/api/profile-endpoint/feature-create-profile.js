'use strict';

const expect = require('chai').expect;
const bus = require('../../../lib/service-bus');

module.exports = function (lambda) {

  describe('for a nonexistent user', () => {

    // Generate 8 random hex characters
    const randomHex = Math.random().toString(16).replace('.', '').slice(-8);
    const identityId = 'eu-west-1:00000000-dead-dead-dead-0000' + randomHex;

    const event = {
      identityId: identityId,
      payload: {
        phone: '+358' + Math.ceil(Math.random() * 1000000000),
      },
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-profile-create', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        });
    });

    it('should not raise an error', () => {
      expect(error).to.be.undefined;
    });

    it(`should return profile with identityId ${identityId}`, () => {
      expect(response).to.not.be.undefined;
      expect(response).to.have.property('identityId');
      expect(response).to.have.property('phone');
      expect(response).to.have.property('balance');
      expect(response.identityId).to.equal(event.identityId);
      expect(response.phone).to.equal(event.payload.phone);
      expect(response.balance).to.equal(0);
    });

  });
};
