
const testLeaveAt = require('./feature-leave-at.js');
const testArriveBy = require('./feature-arrive-by.js');
const test985kAfrica = require('./check-985k-africa.js');

describe('routes provider', function () {

  describe('TripGo (Middle Finland)', function () {
    this.timeout(20000);
    const lambda = require('../../provider-tripgo/provider-tripgo-routes-middlefinland/handler.js');
    testLeaveAt(lambda, { taxiSupport: true });
    testArriveBy(lambda);
    test985kAfrica(lambda);
  });

  describe('TripGo (North Finland)', function () {
    this.timeout(20000);
    const lambda = require('../../provider-tripgo/provider-tripgo-routes-northfinland/handler.js');
    testLeaveAt(lambda, { taxiSupport: true });
    testArriveBy(lambda);
    test985kAfrica(lambda);
  });

  describe('TripGo (South Finland)', function () {
    this.timeout(20000);
    const lambda = require('../../provider-tripgo/provider-tripgo-routes-middlefinland/handler.js');
    testLeaveAt(lambda, { taxiSupport: true });
    testArriveBy(lambda);
    test985kAfrica(lambda);
  });

  describe('Digitransit', function () {
    const lambda = require('../../provider-digitransit/provider-digitransit-routes/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
    test985kAfrica(lambda);
  });

  describe('HERE', function () {
    const lambda = require('../../provider-here/provider-here-routes/handler.js');
    testLeaveAt(lambda);
    test985kAfrica(lambda);
  });

});
