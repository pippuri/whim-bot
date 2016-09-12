'use strict';

const geolocation = require('../../../lib/geolocation');
const expect = require('chai').expect;

describe('geolocation', () => {

  describe('distance', () => {
    it('returns correct metric distance between Helsinki and New York', () => {
      const helsinki = {
        lat: 60.1699,
        lon: 24.9384,
      };
      const newYork = {
        lat: 40.7128,
        lon: -74.0059,
      };
      const distance = 6618000;

      expect(geolocation.distance(helsinki, newYork)).to.be.within(distance - 1000, distance + 1000);
    });
  });
});
