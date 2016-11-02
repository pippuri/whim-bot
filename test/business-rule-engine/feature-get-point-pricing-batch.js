'use strict';

const expect = require('chai').expect;
const bus = require('../../lib/service-bus');

module.exports = function () {
  const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('[POSITIVE] batch query for point pricing', () => {

    let response;
    let error;

    const params = {
      prices: [
        { amount: 77.51, currency: 'EUR' },
        { amount: 77.59, currency: 'EUR' },
        { amount: 81.1, currency: 'EUR' },
        { amount: 83.9, currency: 'EUR' },
        { amount: 85.92, currency: 'EUR' },
        { amount: 88.31, currency: 'EUR' },
      ],
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-point-pricing-batch',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should return a response', () => {
      expect(response).to.not.be.undefined;
    });

    it('should return no error', () => {
      expect(error).to.be.undefined;
    });

    it('response should be an array of prices with type Float or Int', () => {
      expect(response).to.be.an('array');
      expect(response.every(item => Number(item) === item)).to.be.true;
    });
  });

  describe('[NEGATIVE] batch query for point pricing', () => {

    let response;
    let error;

    const params = {
      prices: {},
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-point-pricing-batch',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

    it('should return correct error', () => {
      expect(error).to.not.be.undefined;
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal('500: get-point-pricing-batch: Expected params.prices to be an array of prices, got {}');
    });
  });
};
