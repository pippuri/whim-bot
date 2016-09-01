'use strict';

const proxyquire = require('proxyquire');
const mockData = require('./mock-tsp-responses.json');
const mockConfigurations = require('./mock-tsp-configurations.json');
const testTransportServiceAdapterFactory = require('./transport-service-adapter-factory.js');
const testTransportServiceAdapter = require('./transport-service-adapter.js');
const RequestError = require('request-promise-lite').RequestError;

describe('tsp', () => {
  const TSPAdapter = proxyquire('../../../lib/tsp/TransportServiceAdapter', {
    'request-promise-lite': {
      get: (url, options) => {
        if (/query/.test(url)) {
          return Promise.resolve({ options: [mockData.FullMock.response] });
        }
        return Promise.resolve(mockData.FullMock.response);
      },
      post: (url, options) => {
        if (/invalid/.test(url)) {
          return Promise.resolve('this-is-something-very-faulty');
        }

        if (/faulty/.test(url)) {
          return Promise.resolve({});
        }

        if (/error/.test(url)) {
          return Promise.reject(new RequestError('I\'m a teapot!', 417, 'teapot'));
        }

        return Promise.resolve(mockData.FullMock.response);
      },
      del: (url, options) => {
        return Promise.resolve(mockData.FullMock.response);
      },
      '@global': true,
    },
  });
  const TSPFactory = proxyquire('../../../lib/tsp/TransportServiceAdapterFactory', {
    './tspData-dev.json': mockConfigurations,
  });

  describe('TransportServiceAdapterFactory', () =>  {
    testTransportServiceAdapterFactory(TSPFactory, TSPAdapter);
  });

  describe('TransportServiceAdapter', () =>  {
    testTransportServiceAdapter(TSPAdapter, mockConfigurations, mockData);
  });
});
