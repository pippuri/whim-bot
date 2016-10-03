'use strict';

const bus = require('../../../lib/service-bus');
const expect = require('chai').expect;
const schema = require('maas-schemas/');
const validator = require('../../../lib/validator');
const utils = require('../../../lib/utils');

module.exports = (test, provider) => {

  describe(`${provider.name}: ${test.name}`, () => {

    // Parse the test test params for this individual provider
    const lambda = provider.lambda;
    const providerName = provider.name;
    const input = test.input;
    const results = test.results;

    if (test.inputModifiers && test.inputModifiers[providerName]) {
      utils.merge(input, test.inputModifiers[providerName]);
    }
    if (test.resultsModifiers && test.resultsModifiers[providerName]) {
      utils.merge(results, test.resultsModifiers[providerName]);
    }

    let error;
    let response;

    before(() => {
      return bus.call(lambda, input)
        .then(_response => (response = _response), _error => (error = _error));
    });

    if (results.pass) {
      it('should succeed without errors', () => {
        if (error) {
          console.log('Caught an error:', error.message);
          console.log(error.stack);
        }

        expect(error).to.be.undefined;
      });

      it('should trigger a valid response', () => {
        return validator.validate(schema, response);
      });

      if (results.modes) {
        // TODO Disabled until we explicitly support modes in providers
        xit('should only contain legs with the given modes', () => {
          response.plan.itineraries.forEach(itinerary => {
            itinerary.legs.forEach(leg => {
              expect(leg.mode).to.be.oneOf(results.modes.split(','));
            });
          });
        });
      }

      if (results.count) {
        const min = results.count[0];
        const max = results.count[1];

        it(`should have between ${min} and ${max} results`, () => {
          expect(response.plan.itineraries).to.have.length.within(min, max);
        });
      }
    } else {
      it('should raise an error', () => {
        expect(error).to.not.be.undefined;
      });
    }
  });
};
