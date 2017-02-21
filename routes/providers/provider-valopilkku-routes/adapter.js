'use strict';

const lib = require('./lib');

module.exports = function (original, parsedEvent) {
  const options = lib.selectOptions(original);

  // Extract an itinerary for each option, and then return the final result
  return Promise.all(options.map(option => lib.extractItinerary(option)))
  .then(itineraries => {
    return {
      plan: {
        from: lib.extractFromElement(parsedEvent),
        itineraries: itineraries,
      },
    };
  });
};
