
var testLeaveAt = require('./feature-leave-at.js');
var testArriveBy = require('./feature-arrive-by.js');
var test985kAfrica = require('./check-985k-africa.js');

describe('routes provider', function () {

  describe('TripGo (Middle Finland)', function () {
    this.timeout(20000);
    var lambda = require('../../provider-tripgo/provider-tripgo-routes-middlefinland/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
    test985kAfrica(lambda);
  });

  describe('TripGo (North Finland)', function () {
    this.timeout(20000);
    var lambda = require('../../provider-tripgo/provider-tripgo-routes-northfinland/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
    test985kAfrica(lambda);
  });

  describe('TripGo (South Finland)', function () {
    this.timeout(20000);
    var lambda = require('../../provider-tripgo/provider-tripgo-routes-middlefinland/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
    test985kAfrica(lambda);
  });

  describe.skip('Digitransit', function () {
    var lambda = require('../../provider-digitransit/provider-digitransit-routes/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
    test985kAfrica(lambda);
  });

  describe.skip('HERE', function () {
    var lambda = require('../../provider-here/provider-here-routes/handler.js');
    testLeaveAt(lambda);
    test985kAfrica(lambda);
  });

});
