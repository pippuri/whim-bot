'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const validator = require('../../../lib/validator');
const event = require('../../../geocoding/reverse-geocoding-query/event.json');
const geolocation = require('../../../lib/geolocation');

module.exports = function (lambda) {

  describe('basic query', () => {

    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', () => {
      return validator.validate('maas-backend:geocoding-reverse-response', response);
    });

    it('should order the responses by shortest distance to the reference', () => {
      const c0 = response.features[0].geometry.coordinates;
      const c1 = response.features[1].geometry.coordinates;
      const refPos = { lat: parseFloat(event.payload.lat), lon: parseFloat(event.payload.lon) };
      const dist0 = geolocation.distance(refPos, { lat: c0[0], lon: c0[1] });
      const dist1 = geolocation.distance(refPos, { lat: c1[0], lon: c1[1] });

      expect(dist1 - dist0).to.be.above(0);
    });
  });
};
