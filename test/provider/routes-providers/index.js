'use strict';

const testLeaveAt = require('./feature-leave-at.js');
const testArriveBy = require('./feature-arrive-by.js');
const testFromUnsupported = require('./error-from-unsupported.js');
const testToUnsupported = require('./error-to-unsupported.js');
const test985kAfrica = require('./check-985k-africa.js');
const testFixtureTests = require('./feature-test-fixture.js');
const fixture = require('./fixture.json');

describe('routes provider', () => {

  describe('routes-query-fixture', function () {
    this.timeout(30000);

    fixture.providers.forEach(provider => {
      fixture.cases.forEach(test => {
        testFixtureTests(test, provider);
      });
    });
  });

  describe('TripGo', function () {
    this.timeout(20000);
    const lambda = require('../../../provider-tripgo/provider-tripgo-routes/handler.js');
    testLeaveAt(lambda, { taxiSupport: false });
    testArriveBy(lambda);
    testFromUnsupported(lambda);
    testToUnsupported(lambda);
    test985kAfrica(lambda);
  });

  describe('Digitransit', function () {
    this.timeout(20000);
    const lambda = require('../../../provider-digitransit/provider-digitransit-routes/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda, { skip: true });
    test985kAfrica(lambda);
  });

  describe('HERE', function () {
    this.timeout(20000);
    const lambda = require('../../../provider-here/provider-here-routes/handler.js');
    testLeaveAt(lambda);
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda, { skip: true });
    test985kAfrica(lambda);
  });

  describe('Valopilkku', () => {
    const lambda = require('../../../provider-valopilkku/provider-valopilkku-routes/handler.js');
    testLeaveAt(lambda, { taxiSupport: true });
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda, { skip: true });
    test985kAfrica(lambda, { skip: true });
  });

});
