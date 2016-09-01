'use strict';

const expect = require('chai').expect;

module.exports = function (TSPFactory, TSPAdapter) {

  describe('succeeds on existing adapters', () => {
    let response;
    let error;

    before(done => {
      TSPFactory.createFromAgencyId('FullMock')
      .then(data => {
        response = data;
        done();
      })
      .catch(err => {
        error = err;
        done();
      });
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
    let error;

    before(done => {
      TSPFactory.createFromAgencyId('NoSuchAdapter')
      .then(data => {
        done();
      })
      .catch(err => {
        error = err;
        done();
      });
    });

    it('should reject with an Error', () => {
      expect(error).to.be.an.instanceof(Error);
    });
  });
};
