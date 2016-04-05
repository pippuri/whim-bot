
var testLeaveAt = require('./routes-interface/feature-leave-at.js');
var testArriveBy = require('./routes-interface/feature-arrive-by.js');

describe('Routes provider', function() {

  describe('Tripgo (Middle Finland)', function() {
    this.timeout(20000)
    var handler = require('../provider-tripgo/routes-middlefinland/handler.js').handler;
    testLeaveAt(handler);
    testArriveBy(handler);
  });

  describe('Tripgo (North Finland)', function() {
    this.timeout(20000)
    var handler = require('../provider-tripgo/routes-northfinland/handler.js').handler;
    testLeaveAt(handler);
    testArriveBy(handler);
  });

  describe('Tripgo (South Finland)', function() {
    this.timeout(20000)
    var handler = require('../provider-tripgo/routes-middlefinland/handler.js').handler;
    testLeaveAt(handler);
    testArriveBy(handler);
  });

  describe('Digitransit', function() {
    var handler = require('../provider-digitransit/routes/handler.js').handler;
    testLeaveAt(handler);
    testArriveBy(handler);
  });

  describe('Here', function() {
    var handler = require('../provider-here/routes/handler.js').handler;
    testLeaveAt(handler);
  });

});
