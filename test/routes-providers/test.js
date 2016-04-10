
var testLeaveAt = require('./feature-leave-at.js');
var testArriveBy = require('./feature-arrive-by.js');

describe('routes provider', function() {

  describe('TripGo (Middle Finland)', function() {
    this.timeout(20000)
    var handler = require('../../provider-tripgo/routes-middlefinland/handler.js').handler;
    testLeaveAt(handler);
    testArriveBy(handler);
  });

  describe('TripGo (North Finland)', function() {
    this.timeout(20000)
    var handler = require('../../provider-tripgo/routes-northfinland/handler.js').handler;
    testLeaveAt(handler);
    testArriveBy(handler);
  });

  describe('TripGo (South Finland)', function() {
    this.timeout(20000)
    var handler = require('../../provider-tripgo/routes-middlefinland/handler.js').handler;
    testLeaveAt(handler);
    testArriveBy(handler);
  });

  describe('Digitransit', function() {
    var handler = require('../../provider-digitransit/routes/handler.js').handler;
    testLeaveAt(handler);
    testArriveBy(handler);
  });

  describe('Here', function() {
    var handler = require('../../provider-here/routes/handler.js').handler;
    testLeaveAt(handler);
  });

});
