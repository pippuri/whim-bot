'use strict';

const testSetActiveItinerary = require('./tracking-set-active-itinerary.js');

describe('tracking endpoint', function () {
  this.timeout(20000);

  const createLambda = require('../../../itineraries/itinerary-create/handler.js');
  const setActiveLambda = require('../../../tracking/tracking-set-active-itinerary/handler.js');

  describe('tracking-set-active-itinerary', function () {
    this.timeout(20000);
    testSetActiveItinerary(createLambda, setActiveLambda);
  });
});
