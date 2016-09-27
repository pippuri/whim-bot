'use strict';

const expect = require('chai').expect;
const bus = require('../../lib/service-bus');

module.exports = function () {

  const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('[POSITIVE] query for tsp pricing', () => {

    let response;
    let error;

    const params = {
      type: 'maas',
      location: {
        from: {
          lat: 60.1657541,
          lon: 24.9417641,
        },
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

    it('should succeed and return a provider', () => {
      expect(response).to.not.be.undefined;
      expect(response.providerName).to.not.be.undefined;
      expect(response.providerMeta).to.not.be.undefined;
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
        type: 'maas',
        location: {
          from: {
            lat: 60.1657541,
            lon: 24.9417641,
          },
        },
      },
      {
        type: 'taxi',
        location: {
          from: {
            lat: 60.1657541,
            lon: 24.9417641,
          },
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

  describe('[NEGATIVE] query for tsp pricing with invalid type', () => {

    let response;
    let error;

    const params = {
      type: 'lorem-ipsum',
      location: {
        from: {
          lat: 60.1657541,
          lon: 24.9417641,
        },
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

    it('Should not return an error', () => {
      expect(error).to.be.undefined;
    });

    it('Should return an empty array as response', () => {
      expect(response).to.not.be.undefined;
      expect(response).to.be.an('array');
      expect(response.length).to.equal(0);
    });

  });

  describe('[NEGATIVE] query for tsp pricing with empty or missing location', () => {

    let response;
    let error;

    const params = {
      type: 'lorem-ipsum',
      location: {},
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

    it('Should not return an error', () => {
      expect(error).to.not.be.undefined;
      expect(error.message).to.equal('No location supplied to TSP engine');
    });

    it('Should return an empty array as response', () => {
      expect(response).to.be.undefined;
    });

  });

  describe('[NEGATIVE] batch query for tsp pricing with invalid types', () => {

    let response;
    let error;

    const params = [
      {
        type: 'tsp-hasta-lavista',
        location: {
          from: {
            lat: 60.1657541,
            lon: 24.9417641,
          },
        },
      },
      {
        type: 'tsp-iam-not-real',
        location: {
          from: {
            lat: 60.1657541,
            lon: 24.9417641,
          },
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

    it('Should return a response', () => {
      expect(response).to.not.be.undefined;
    });

    it('Should not return an error', () => {
      expect(error).to.be.undefined;
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
        location: {},
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
      expect(error.message).to.equal('One or more request does not supply location to the TSP engine');
    });

  });
};
