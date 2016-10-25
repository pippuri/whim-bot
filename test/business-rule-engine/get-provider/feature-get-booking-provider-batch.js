'use strict';

const bus = require('../../../lib/service-bus');
const expect = require('chai').expect;

module.exports = function () {

  const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('[POSITIVE] batch get booking provider with Array request', () => {
    let response;
    let error;

    const event = [
      {
        agencyId: 'HSL',
        from: { lat: 60.1657541, lon: 24.9417641 },
      },
      {
        agencyId: 'Valopilkku',
        from: { lat: 60.1657541, lon: 24.9417641 },
      },
    ];

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-booking-provider-batch',
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
      expect(response).to.not.be.undefined;
      expect(response).is.an('array');
      expect(response).to.have.length.least(2);
    });

  });

  describe('[POSITIVE] batch get booking provider with Object request', () => {
    let response;
    let error;

    const event = {
      HSL: [
        {
          agencyId: 'HSL',
          from: { lat: 60.1657541, lon: 24.9417641 },
        },
      ],
      Valopilkku: [
        {
          agencyId: 'Valopilkku',
          from: { lat: 60.1657541, lon: 24.9417641 },
        },
      ],
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-booking-provider-batch',
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
      expect(response).to.not.be.undefined;
      expect(response).to.be.an('object');
      expect(response).to.have.property('HSL');
      expect(response).to.have.property('Valopilkku');
      expect(response.HSL).to.be.an('array');
      expect(response.HSL[0]).to.be.an('array');
      expect(response.HSL[0].length).to.equal(3); // A location can be wrapped only by 1 seutu ticket || 1 lahiseutu-2 || 1 lahiseutu-3
      expect(response.Valopilkku).to.be.an('array');
      expect(response.Valopilkku[0]).to.be.an('array');
      expect(response.Valopilkku.length).to.equal(1);
    });

  });
};
