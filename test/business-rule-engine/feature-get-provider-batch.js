'use strict';

const expect = require('chai').expect;
const bus = require('../../lib/service-bus');

module.exports = function () {

  const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('[POSITIVE] batch query for provider with array input', () => {

    let response;
    let error;

    const params = [
      {
        type: 'tsp-booking-hsl',
        location: {
          name: 'Rautatieasema',
          stopId: 'HSL:1531116',
          stopCode: '4572',
          lon: 24.9413,
          lat: 60.17036,
        },
      },
      {
        type: 'tsp-booking-hsl',
        location: {
          name: 'Kamppi',
          stopId: 'HSL:1040601',
          stopCode: '0013',
          lon: 24.931497,
          lat: 60.168901,
        },
      },
    ];

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-provider-batch',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should return an array response', () => {
      expect(response).to.not.be.undefined;
      expect(response).to.be.an('array');
    });

    it('should not return an error', () => {
      expect(error).to.be.undefined;
    });

  });

  describe('[NEGATIVE] batch query for provider with array input', () => {

    let response;
    let error;

    const params = [
      {
        // Location with no type
        location: {
          name: 'Rautatieasema',
          stopId: 'HSL:1531116',
          stopCode: '4572',
          lon: 24.9413,
          lat: 60.17036,
        },
      },
      {
        // Booking provider -- wrong type
        type: 'tsp-booking-hsl',
      },
    ];

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-provider-batch',
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

    it('should return a valid error', () => {
      expect(error).to.not.be.undefined;
      expect(error).to.be.an.instanceOf(Error);
    });
  });

  describe('[POSITIVE] batch query for provider with object input', () => {

    let response;
    let error;

    const params = {
      a: [
        {
          type: 'tsp-booking-hsl',
          location: {
            name: 'Rautatieasema',
            stopId: 'HSL:1531116',
            stopCode: '4572',
            lon: 24.9413,
            lat: 60.17036,
          },
        },
        {
          type: 'tsp-booking-hsl',
          location: {
            name: 'Kamppi',
            stopId: 'HSL:1040601',
            stopCode: '0013',
            lon: 24.931497,
            lat: 60.168901,
          },
        },
      ],
      b: [
        {
          type: 'tsp-booking-hsl',
          location: {
            name: 'Rautatieasema',
            stopId: 'HSL:1531116',
            stopCode: '4572',
            lon: 24.9413,
            lat: 60.17036,
          },
        },
        {
          type: 'tsp-booking-hsl',
          location: {
            name: 'Kamppi',
            stopId: 'HSL:1040601',
            stopCode: '0013',
            lon: 24.931497,
            lat: 60.168901,
          },
        },
      ],
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-provider-batch',
        parameters: params,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should return an object response with same key as input', () => {
      expect(response).to.not.be.undefined;
      expect(response).to.be.an('object');
      expect(Object.keys(response)).to.deep.equal(Object.keys(params));
    });

    it('should not return an error', () => {
      expect(error).to.be.undefined;
    });

  });

  describe('[NEGATIVE] batch query for provider with empty object input', () => {

    let response;
    let error;

    const params = {
      a: {},
      b: {},
    };

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-provider-batch',
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

    it('should return an error', () => {
      expect(error).to.not.be.undefined;
      expect(error).to.be.an.instanceOf(Error);
      // TODO Instead of running into such errors, we should validate the input
      // to prevent we don't stumble into this kinds of runtime errors
      //expect(error.message).to.equal('500: Internal server error: TypeError: requests[key].forEach is not a function');
    });
  });
};
