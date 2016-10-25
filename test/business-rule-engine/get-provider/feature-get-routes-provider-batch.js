'use strict';

const bus = require('../../../lib/service-bus');
const expect = require('chai').expect;

module.exports = function () {

  const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('[POSITIVE] batch get routes provider with Array request', () => {
    let response;
    let error;

    const event = [
      {
        mode: 'TAXI',
        type: 'routes-taxi',
        location: { lat: 60.1657541, lon: 24.9417641 },
      },
      {
        mode: 'PUBLIC_TRANSIT',
        type: 'routes-pt',
        location: { lat: 60.1557541, lon: 24.9423641 },
      },
      {
        mode: 'BICYCLE',
        type: 'routes-private',
        location: { lat: 60.16854341, lon: 24.94232641 },
      },
      {
        mode: 'WALK',
        type: 'routes-private',
        location: { lat: 60.1634541, lon: 24.92347641 },
      },
    ];

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-routes-provider-batch',
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
      expect(response).to.have.length.least(4);
    });

  });

  describe('[POSITIVE] batch get routes provider with Object request', () => {
    let response;
    let error;

    const event = {
      TAXI: [
        {
          mode: 'TAXI',
          type: 'routes-taxi',
          location: { lat: 60.1657541, lon: 24.9417641 },
        },
        {
          mode: 'TAXI',
          type: 'routes-taxi',
          location: { lat: 60.1657541, lon: 24.9417641 },
        },
      ],
      PUBLIC_TRANSIT: [
        {
          mode: 'PUBLIC_TRANSIT',
          type: 'routes-pt',
          location: { lat: 60.1657541, lon: 24.9417641 },
        },
        {
          mode: 'PUBLIC_TRANSIT',
          type: 'routes-pt',
          location: { lat: 60.1634541, lon: 24.92347641 },
        },
      ],
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-routes-provider-batch',
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
      expect(response).to.have.property('PUBLIC_TRANSIT');
      expect(response).to.have.property('TAXI');
      expect(response.PUBLIC_TRANSIT).to.be.an('array');
      expect(response.PUBLIC_TRANSIT.length).to.equal(2);
      expect(response.TAXI).to.be.an('array');
      expect(response.TAXI.length).to.equal(2);
    });

  });
};
