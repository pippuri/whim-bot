'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-payment-put/handler.js');

module.exports = function (identityId) {

  describe('profile-card-update', function () { //eslint-disable-line
    this.timeout(10000);

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
        country: 'FI',
        card: {
          number: '4242424242424242',
          cvv: 100,
          expiryMonth: '10',
          expiryYear: '2017',
        },
      },
    };

    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(`Event: '${JSON.stringify(event, null, 2)}'`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.have.deep.property('profile.card');
      expect(response).to.have.deep.property('profile.identityId');
      expect(response).to.have.deep.property('profile.firstName');
      expect(response).to.have.deep.property('profile.lastName');
    });
  });
};
