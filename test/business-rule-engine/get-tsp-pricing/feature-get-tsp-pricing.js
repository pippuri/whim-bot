'use strict';

const expect = require('chai').expect;
const bus = require('../../../lib/service-bus');

module.exports = function () {

  const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('[POSITIVE] query for tsp pricing of agencyId "HSL"', () => {

    let response;
    let error;

    const params = {
      agencyId: 'HSL',
      from: {
        lat: 60.1657541,
        lon: 24.9417641,
      },
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-tsp-pricing',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it(`should succeed and return all provider with agencyId ${params.agencyId}`, () => {
      response.forEach(item => {
        expect(item).to.not.be.undefined;
        expect(item.providerName).to.not.be.undefined;
        expect(item.providerPrio).to.not.be.undefined;
        expect(item.agencyId).to.equal(params.agencyId);
      });
    });

    it('should not return an error', () => {
      expect(error).to.be.undefined;
    });

  });

  describe('[POSITIVE] batch query for tsp pricing', () => {

    let response;
    let error;

    const params = [
      {
        agencyId: 'HSL',
        from: {
          lat: 60.1657541,
          lon: 24.9417641,
        },
      },
      {
        agencyId: 'Valopilkku',
        from: {
          lat: 60.1657541,
          lon: 24.9417641,
        },
      },
    ];

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-tsp-pricing-batch',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('Should succeed without error', () => {
      expect(error).to.be.undefined;
    });


    it('Should succeed and return at least the same number of providers as requested', () => {
      expect(response).to.not.be.undefined;
      expect(response).to.be.an('array');
      expect(response.length).to.be.least(params.length);
    });


  });

  describe('[NEGATIVE] query for tsp pricing with no agencyId', () => {

    let response;
    let error;

    const params = {
      type: 'lorem-ipsum',
      from: {
        lat: 60.1657541,
        lon: 24.9417641,
      },
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-tsp-pricing',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('Should return an error', () => {
      expect(error).to.not.be.undefined;
      expect(error.message).to.equal('400: get-routes: No agencyId supplied to the engine');
    });

    it('Should not return any response', () => {
      expect(response).to.be.undefined;
    });
  });

  describe('[NEGATIVE] query for tsp pricing with empty or missing \'from\'', () => {

    let response;
    let error;

    const params = {
      agencyId: 'HSL',
      from: {},
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-tsp-pricing',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('Should return an error', () => {
      expect(error).to.not.be.undefined;
      expect(error.message).to.equal('400: get-routes: No \'from\' supplied to the TSP engine');
    });

    it('Should not return a response', () => {
      expect(response).to.be.undefined;
    });

  });

  describe('[NEGATIVE] batch query for tsp pricing with missing agencyId', () => {

    let response;
    let error;

    const params = [
      {
        type: 'tsp-hasta-lavista',
        from: {
          lat: 60.1657541,
          lon: 24.9417641,
        },
      },
      {
        type: 'tsp-iam-not-real',
        from: {
          lat: 60.1657541,
          lon: 24.9417641,
        },
      },
    ];

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-tsp-pricing-batch',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('Should return an error', () => {
      expect(error).to.not.be.undefined;
      expect(error.message).to.equal('400: get-routes: The request does not supply \'agencyId\' to the TSP engine: {"type":"tsp-hasta-lavista","from":{"lat":60.1657541,"lon":24.9417641}}');
    });

    it('Should return a response', () => {
      expect(response).to.be.undefined;

    });
  });

  describe('[NEGATIVE] batch query for tsp pricing with one of them missing a location', () => {

    let response;
    let error;

    const params = [
      {
        type: 'tsp-hasta-lavista',
      },
      {
        type: 'tsp-iam-not-real',
        from: {},
      },
    ];

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-tsp-pricing-batch',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('Should not return a response', () => {
      expect(response).to.be.undefined;
    });

    it('Should return an error', () => {
      expect(error).to.not.be.undefined;
      expect(error).to.be.an.instanceOf(Error);
    });
  });
};
