'use strict';

const testLeaveAt = require('./feature-leave-at.js');
const testArriveBy = require('./feature-arrive-by.js');
const testToAntarctica = require('./error-to-antarctica.js');
const testFromAntarctica = require('./error-from-antarctica.js');
const testRovaniemi = require('./check-rovaniemi.js');
const test985kAfrica = require('./check-985k-africa.js');

describe('routes provider', function () {

  describe('TripGo', function () {
    this.timeout(20000);
    const lambda = require('../../provider-tripgo/provider-tripgo-routes/handler.js');
    testLeaveAt(lambda, { taxiSupport: true });
    testArriveBy(lambda);
    testToAntarctica(lambda);
    testFromAntarctica(lambda);
    testRovaniemi(lambda, { skip: true });
    test985kAfrica(lambda);
  });

  describe('Digitransit', function () {
    const lambda = require('../../provider-digitransit/provider-digitransit-routes/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
    testToAntarctica(lambda, { skip: true });
    testFromAntarctica(lambda, { skip: true });
    testRovaniemi(lambda, { skip: true });
    test985kAfrica(lambda);
  });

  describe('HERE', function () {
    const lambda = require('../../provider-here/provider-here-routes/handler.js');
    testLeaveAt(lambda);
    testToAntarctica(lambda, { skip: true });
    testFromAntarctica(lambda, { skip: true });
    testRovaniemi(lambda, { skip: true });
    test985kAfrica(lambda);
  });

});
