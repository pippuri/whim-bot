'use strict';

const bus = require('../../../lib/service-bus');
const expect = require('chai').expect;

module.exports = function () {

  describe('[POSITIVE] batch get booking providers by agencyId and location 1', () => {
    let response;
    let error;

    const event = {
      agencyId: 'HSL',
      from: { lat: 60.1657541, lon: 24.9417641 },
      to: { lat: 60.164056, lon: 24.925577 },
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        rule: 'get-booking-providers-by-agency-location',
        parameters: event,
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
      expect(response).is.an('array');
      expect(response).to.have.length.least(2);
      expect(response[0]).to.have.deep.property('agencyId', 'HSL');
    });
  });

  describe('[POSITIVE] batch get booking providers by agencyId and location 2', () => {
    let response;
    let error;

    const event = {
      agencyId: 'Valopilkku',
      from: { lat: 60.1657541, lon: 24.9417641 },
      to: { lat: 60.164056, lon: 24.925577 },
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        rule: 'get-booking-providers-by-agency-location',
        parameters: event,
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
      expect(response).is.an('array');
      expect(response).to.have.length.least(1);
      expect(response[0]).to.have.deep.property('agencyId', 'Valopilkku');
      expect(response[0]).to.be.an('object');
    });
  });

};
