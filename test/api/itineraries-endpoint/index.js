'use strict';

const testCreateItinerary = require('./itinerary-create.js');
const testCancelItinerary = require('./itinerary-cancel.js');
const testRetrieveItinerary = require('./itinerary-retrieve.js');
const testListItinerary = require('./itinerary-list.js');
const testFullFlow = require('./itinerary-full-flow');
const fixture = require('./fixture.json');

describe('itineraries endpoint', function () {
  this.timeout(20000);

  const createLambda = require('../../../itineraries/itinerary-create/handler.js');
  const retrieveLambda = require('../../../itineraries/itinerary-retrieve/handler.js');
  const listLambda = require('../../../itineraries/itinerary-list/handler.js');
  const cancelLambda = require('../../../itineraries/itinerary-cancel/handler.js');

  describe.skip('itinerary-create', function () {
    this.timeout(20000);
    testCreateItinerary(createLambda);
  });

  describe.skip('itinerary-retrieve', function () {
    this.timeout(20000);
    testRetrieveItinerary(createLambda, retrieveLambda);
  });

  describe.skip('itinerary-list', function () {
    this.timeout(20000);
    testListItinerary(createLambda, listLambda);
  });

  describe.skip('itinerary-cancel', function () {
    this.timeout(20000);
    testCancelItinerary(createLambda, cancelLambda);
  });

  describe('itineraries endpoint', function () {
    this.timeout(20000);

    fixture.forEach(test => {
      if (test.skip) {
        return;
      }

      describe(`itinerary-full-flow: ${test.name}`, () => {
        testFullFlow(test.input, test.results);
      });
    });
  });

});
