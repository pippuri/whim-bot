'use strict';

const testLeaveAt = require('./feature-leave-at.js');
const testArriveBy = require('./feature-arrive-by.js');
const testFromUnsupported = require('./error-from-unsupported.js');
const testToUnsupported = require('./error-to-unsupported.js');
const test985kAfrica = require('./check-985k-africa.js');
const testFixtureTests = require('./feature-test-fixture.js');
const fixture = require('./fixture.json');

describe('routes provider', () => {

  describe('routes-query-fixture', () => {
    fixture.providers.forEach(provider => {
      fixture.cases.forEach(test => {
        testFixtureTests(test, provider);
      });
    });
  });

/*
  describe('TripGo', () => {
    const lambda = require('../../../routes/providers/provider-tripgo-routes/handler.js');
    testLeaveAt(lambda, { taxiSupport: false });
    testArriveBy(lambda);
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda);
    test985kAfrica(lambda);
  });
*/

  describe('Digitransit', () => {
    const lambda = require('../../../routes/providers/provider-digitransit-routes/handler.js');
    const lib = require('../../../routes/providers/provider-digitransit-routes/lib.js');
    const testLib = require('./digitransit-lib');

    testLib(lib);
    testLeaveAt(lambda);
    testArriveBy(lambda);
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda, { skip: true });
    test985kAfrica(lambda);
  });

  describe('HERE', () => {
    const lambda = require('../../../routes/providers/provider-here-routes/handler.js');
    testLeaveAt(lambda);
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda, { skip: true });
    test985kAfrica(lambda);
  });

  describe('Valopilkku', () => {
    const lambda = require('../../../routes/providers/provider-valopilkku-routes/handler.js');
    testLeaveAt(lambda, { taxiSupport: true });
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda, { skip: true });
    test985kAfrica(lambda, { skip: true });
  });
});
