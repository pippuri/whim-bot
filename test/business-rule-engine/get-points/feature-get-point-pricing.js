'use strict';

const expect = require('chai').expect;
const bus = require('../../../lib/service-bus');

module.exports = function () {

  const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('[POSITIVE] query for point pricing', () => {

    let response;
    let error;

    const params = {
      currency: 'EUR',
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-point-pricing',
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

    it('response should be a number with type Float', () => {
      expect(response).to.be.a('number');
    });
  });

  describe('[NEGATIVE] query for point pricing', () => {
    let response;
    let error;

    const params = {
      currency: 'unknown',
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-point-pricing',
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
      expect(response).to.be.undefined;
    });

    it('should return correct error', () => {
      expect(error).to.not.be.undefined;
      expect(error.message).to.equal('400: get-points: Currency \'unknown\' is unsupported');
    });
  });
};
