'use strict';

const bus = require('../../../lib/service-bus');
const expect = require('chai').expect;

module.exports = function () {

  describe('[POSITIVE] get routes provider with Array of modes', () => {
    let response;
    let error;

    const params = ['TAXI', 'PUBLIC_TRANSIT', 'BICYCLE', 'WALK'];

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        rule: 'get-routes-providers-by-modes',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should not return any error', () => {
      expect(error).to.be.undefined;
    });

    it('should return valid responses', () => {
      expect(response).to.not.be.undefined;
      expect(response).to.be.an('object');
      expect(response).to.have.property('PUBLIC_TRANSIT');
      expect(response).to.have.property('TAXI');
      expect(response.PUBLIC_TRANSIT).to.be.an('array');
      expect(response.PUBLIC_TRANSIT.length).to.be.at.least(2);
      expect(response.TAXI).to.be.an('array');
      expect(response.TAXI.length).to.be.at.least(2);
    });
  });
};
