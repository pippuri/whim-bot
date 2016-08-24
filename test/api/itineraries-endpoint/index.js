'use strict';

const testCreateItinerary = require('./itinerary-create.js');
const testCancelItinerary = require('./itinerary-cancel.js');
const testRetrieveItinerary = require('./itinerary-retrieve.js');
const testListItinerary = require('./itinerary-list.js');

describe('itineraries endpoint', function () {
  this.timeout(20000);

  const createLambda = require('../../../itineraries/itinerary-create/handler.js');
  const retrieveLambda = require('../../../itineraries/itinerary-retrieve/handler.js');
  const listLambda = require('../../../itineraries/itinerary-list/handler.js');
  const cancelLambda = require('../../../itineraries/itinerary-cancel/handler.js');

  describe('itinerary-create', function () {
    this.timeout(20000);
    testCreateItinerary(createLambda);
  });

  describe('itinerary-retrieve', function () {
    this.timeout(20000);
    testRetrieveItinerary(createLambda, retrieveLambda);
  });

  describe('itinerary-list', function () {
    this.timeout(20000);
    testListItinerary(createLambda, listLambda);
  });

  describe('itinerary-cancel', function () {
    this.timeout(20000);
    testCancelItinerary(createLambda, cancelLambda);
  });
});
