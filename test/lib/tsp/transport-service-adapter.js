'use strict';

const expect = require('chai').expect;

module.exports = function (TSPAdapter, mockConfigurations, mockData) {
  const adapter = new TSPAdapter(mockConfigurations.FullMock);
  const faultyAdapter = new TSPAdapter(mockConfigurations.FaultyMock);
  const invalidAdapter = new TSPAdapter(mockConfigurations.InvalidMock);
  const errorAdapter = new TSPAdapter(mockConfigurations.ErrorMock);

  describe('reserve', () => {
    let response;
    let error;

    before(() => {
      return adapter.reserve(mockData.FullMock.booking)
        .then(_response => (response = _response), _error => (error = _error));
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should have a valid response', () => {
      expect(response).to.have.deep.property('tspId');
      expect(response).to.have.deep.property('leg');
      expect(response).to.have.deep.property('terms');
      expect(response).to.have.deep.property('meta');
      expect(response).to.not.have.deep.property('customer');
      expect(response).to.not.have.deep.property('state');
      expect(response).to.not.have.deep.property('id');
    });
  });

  describe('faulty reservation', () => {
    let error;

    before(() => {
      return adapter.reserve({})
        .catch(_error => (error = _error));
    });

    it('should fail with an error', () => {
      expect(error).to.be.an.instanceof(Error);
    });
  });

  describe('faulty reservation response', () => {
    let error;

    before(() => {
      return faultyAdapter.reserve(mockData.FullMock.booking)
        .catch(_error => (error = _error));
    });

    it('should fail with an error', () => {
      expect(error).to.be.an.instanceof(Error);
    });
  });

  describe('invalid reservation response', () => {
    let error;

    before(() => {
      return invalidAdapter.reserve(mockData.FullMock.booking)
        .catch(_error => (error = _error));
    });

    it('should fail with an error', () => {
      expect(error).to.be.an.instanceof(Error);
    });
  });

  describe('error in reservation response', () => {
    let error;

    before(() => {
      return errorAdapter.reserve(mockData.FullMock.booking)
        .catch(_error => (error = _error));
    });

    it('should fail with an error', () => {
      expect(error).to.be.an.instanceof(Error);
    });
  });

  describe('retrieve', () => {
    let response;
    let error;

    before(() => {
      return adapter.retrieve('tsp-123456')
        .then(_response => (response = _response), _error => (error = _error));
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should have a valid response', () => {
      // Attributes that should be transmitted
      expect(response).to.have.property('tspId');
      expect(response).to.have.property('leg');
      expect(response).to.have.property('terms');
      expect(response).to.have.property('meta');
      expect(response.state).to.be.a('string');

      // Attributes that should have been pruned away
      expect(response).to.not.have.property('customer');
      expect(response).to.not.have.property('id');
    });
  });

  describe('cancel', () => {
    let error;

    before(() => {
      return adapter.cancel('tsp-123456')
        .catch(_error => (error = _error));
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });
  });

  describe('query', () => {
    let response;
    let error;

    before(() => {
      return adapter.query({ startTime: 1234567 })
        .then(_response => (response = _response), _error => (error = _error));
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should have a valid response', () => {
      expect(response).to.have.deep.property('tspId');
      expect(response).to.have.deep.property('leg');
      expect(response).to.have.deep.property('terms');
      expect(response).to.have.deep.property('meta');
      expect(response).to.not.have.deep.property('customer');
      expect(response).to.not.have.deep.property('state');
      expect(response).to.not.have.deep.property('id');
    });
  });
};
