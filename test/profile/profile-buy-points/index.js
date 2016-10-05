'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-top-up/handler.js');

module.exports = function () {

  describe('profile-top-up', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        productId: 'fi-whim-points-purchase-payg',
        amount: '500',
        //chargeOK: '2500',
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
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should return message with amount', () => {
      expect(response).to.have.deep.property('message');
      expect(response).to.have.deep.property('confirm');
      expect(response).to.have.deep.property('price');
    });
  });

  describe('profile-top-up-ok', function () { //eslint-disable-line
    this.timeout(10000);
    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
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
        done();
      });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should return profile with new amount', () => {
      expect(response).to.have.deep.property('profile');
    });
  });
};
