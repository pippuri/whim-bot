'use strict';

const Database = require('../../../lib/models/Database');
const routesProviders = require('../../../routes/routes-query/lib/routes-providers');
const expect = require('chai').expect;

module.exports = function () {

  describe('[POSITIVE] get routes provider with Array of modes', () => {
    let response;
    let error;

    const params = ['TAXI', 'PUBLIC_TRANSIT', 'BICYCLE', 'WALK'];

    before(done => {
      Database.init()
        .then(() => routesProviders.getRoutesProvidersByModesList(params))
        .then(res => {
          response = res;
          done();
        })
        .catch(err => {
          error = err;
          done();
        })
        .finally(() => {
          Database.cleanup();
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
      expect(response.PUBLIC_TRANSIT.length).to.be.at.least(2);
      expect(response.TAXI).to.be.an('array');
      expect(response.TAXI.length).to.be.at.least(2);
    });
  });
};
