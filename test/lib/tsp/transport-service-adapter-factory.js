'use strict';

const expect = require('chai').expect;

module.exports = function (TSPFactory, TSPAdapter) {

  describe('succeeds on existing adapters', () => {
    let response;
    let error;

    before(() => {
      return TSPFactory.createFromAgencyId('FullMock')
        .then(
          data => (response = data),
          err => (error = err)
        );
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should have a TSP with the same id as the agencyId specified', () => {
      //expect(response).to.be.an.instanceof(TSPAdapter);
      expect(response.id).to.equal('FullMock');
    });
  });

  describe('fails on non-existing adapters', () => {
    it('should reject with an Error', () => {
      return TSPFactory.createFromAgencyId('NoSuchAdapter')
        .then(
          data => Promise.reject('Adapter created even if there is none.'),
          error => Promise.resolve()
        );
    });
  });
};
