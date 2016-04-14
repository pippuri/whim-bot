
var testLeaveAt = require('./feature-leave-at.js');
var testArriveBy = require('./feature-arrive-by.js');

describe('routes provider', function () {

  describe('TripGo (Middle Finland)', function () {
    this.timeout(20000);
    var lambda = require('../../provider-tripgo/routes-middlefinland/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
  });

  describe('TripGo (North Finland)', function () {
    this.timeout(20000);
    var lambda = require('../../provider-tripgo/routes-northfinland/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
  });

  describe('TripGo (South Finland)', function () {
    this.timeout(20000);
    var lambda = require('../../provider-tripgo/routes-middlefinland/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
  });

  describe('Digitransit', function () {
    var lambda = require('../../provider-digitransit/routes/handler.js');
    testLeaveAt(lambda);
    testArriveBy(lambda);
  });

  describe('Here', function () {
    var lambda = require('../../provider-here/routes/handler.js');
    testLeaveAt(lambda);
  });

});
