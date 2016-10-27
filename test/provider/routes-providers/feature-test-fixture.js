'use strict';

const moment = require('moment-timezone');
const bus = require('../../../lib/service-bus');
const expect = require('chai').expect;
const schema = require('maas-schemas/');
const validator = require('../../../lib/validator');
const utils = require('../../../lib/utils');
const clone = require('lodash/clone');

module.exports = (test, provider) => {

  function updateTime(originalUTCMillis) {
    // Move leaveAt week to match a date in the future (this or next week)
    const original = moment(parseFloat(originalUTCMillis));
    const updated = moment(original);
    const now = moment().tz('Europe/Helsinki');
    updated.year(now.year());
    updated.week(now.week());
    if (now.day() >= updated.day()) {
      updated.week(now.week() + 1);
    }

    return updated.valueOf();
  }

  let testName = `${provider.name}: ${test.name}`;

  if (test.input.leaveAt) {
    const updated = updateTime(test.input.leaveAt);
    test.input.leaveAt = updated;
    testName += `, leave at: ${moment(updated).format('DD.MM.YYYY, HH:mm:ss Z')}`;
  }

  if (test.input.arriveBy) {
    const updated = updateTime(test.input.arriveBy);
    test.input.arriveBy = updated;
    testName += `, arrive by: ${moment(updated).format('DD.MM.YYYY, HH:mm:ss Z')}`;
  }

  describe(testName, () => {

    // Parse the test test params for this individual provider
    const lambda = provider.lambda;
    const providerName = provider.name;

    // These are clones so that possible modifiers don't affect other providers
    const input = clone(test.input);
    const results = clone(test.results);

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
        .then(_response => {
          response = _response;
        })
        .catch(_error => {
          error = _error;
        });
    });

    if (results.pass) {
      it('should succeed without errors', () => {
        if (error) {
          console.log('Caught an error:', error.message);
          console.log(error.stack);
        }
        expect(response).to.not.be.undefined;
        expect(error).to.be.undefined;
      });


      it('should trigger a valid response', () => {
        return validator.validate(schema, response);
      });

      if (results.modes) {
        // TODO Disabled until we explicitly support modes in providers
        it('should only contain legs with the given modes', () => {
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
