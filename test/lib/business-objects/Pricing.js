'use strict';

const expect = require('chai').expect;
const Pricing = require('../../../lib/business-objects/Pricing');

describe('Pricing', () => {
  describe('convertCostToPoints', () => {
    it('should convert 1€ to 20 points', () => {
      Pricing.convertCostToPoints(1, 'EUR')
        .then(points => expect(points).to.equal(20));
    });

    it('should round up to the nearest integer with no decimals', () => {
      Pricing.convertCostToPoints(9.99, 'EUR')
        .then(points => expect(points.toString()).equal('200'));
    });
  });

  describe('convertPointsToCost', () => {
    it('should convert 1 point to 5 cents', () => {
      Pricing.convertPointsToCost(1, 'EUR')
        .then(euros => expect(euros).to.equal(0.05));
    });

    it('should round the currencies to two decimals', () => {
      Pricing.convertPointsToCost(0.1, 'EUR')
        .then(euros => expect(euros.toString()).to.equal(0.01));
    });
  });
});
