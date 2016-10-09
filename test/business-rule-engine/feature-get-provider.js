'use strict';

const expect = require('chai').expect;
const bus = require('../../lib/service-bus');

module.exports = function () {
  const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('[POSITIVE] query for provider by type', () => {
    const params = {
      type: 'maas-routes-pt',
      // Somewhere in Lohja
      location: {
        lat: 60.20295,
        lon: 24.11314,
      },
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-provider',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should return providers with providerMeta', () => {
      expect(response).to.be.an('array');
      expect(response.length).to.be.least(1);
      response.forEach(res => {
        expect(res).to.be.an('object');
        expect(res).to.have.property('providerMeta');
      });
    });
  });

  describe('[POSITIVE] query for provider by name', () => {

    const params = {
      providerName: 'MaaS-provider-valopilkku',
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        rule: 'get-provider',
        parameters: params,
      })
      .then(data => {
        response = data;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should return an array with at least 1 provider with providerMeta', () => {
      expect(response).to.be.an('array');
      expect(response[0]).to.be.an('object');
      expect(response[0]).to.have.property('providerMeta');
    });
  });

  describe('[POSITIVE] query for provider by agencyId', () => {

    const params = {
      type: 'tsp-booking-taxi',
      agencyId: 'Valopilkku',
    };

    let error;
    let response;

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-provider',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it(`should return an array with at least 1 provider with providerMeta, which contains agencyId ${params.agencyId}`, () => {
      expect(response).to.be.an('array');
      expect(response[0]).to.be.an('object');
      expect(response[0]).to.have.property('providerMeta');
      expect(response[0].agencyId).to.equal(params.agencyId);
    });
  });
};
