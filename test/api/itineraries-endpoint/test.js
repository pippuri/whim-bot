var testCreateItinerary = require('./itinerary-create.js');

describe('itineraries endpoint', function () {
  this.timeout(20000);

  var lambda = require('../../../itineraries/itinerary-create/handler.js');
  testCreateItinerary(lambda);
});
