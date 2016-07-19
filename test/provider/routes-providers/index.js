'use strict';

const testLeaveAt = require('./feature-leave-at.js');
const testArriveBy = require('./feature-arrive-by.js');
const testFromUnsupported = require('./error-from-unsupported.js');
const testToUnsupported = require('./error-to-unsupported.js');
const test985kAfrica = require('./check-985k-africa.js');

describe('routes provider', () => {

  describe('TripGo', function () {
    this.timeout(20000);
    const lambda = require('../../../provider-tripgo/provider-tripgo-routes/handler.js');
    testLeaveAt(lambda, { taxiSupport: true });
    testArriveBy(lambda);
    testFromUnsupported(lambda);
    testToUnsupported(lambda);
    test985kAfrica(lambda);
  });

  describe('Digitransit', () => {
    const lambda = require('../../../provider-digitransit/provider-digitransit-routes/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda, { skip: true });
    test985kAfrica(lambda);
  });

  describe('HERE', () => {
    const lambda = require('../../../provider-here/provider-here-routes/handler.js');
    testLeaveAt(lambda);
    testFromUnsupported(lambda, { skip: true });
    testToUnsupported(lambda, { skip: true });
    test985kAfrica(lambda);
  });

});
