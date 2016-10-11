'use strict';

const Promise = require('bluebird');
const lib = require('./lib');

module.exports = function (original, parsedEvent) {
  const options = lib.selectOptions(original);

  // Extract an itinerary for each option, and then return the final result
  return Promise.map(options, option => {
    return lib.extractItinerary(option);
  })
  .then(itineraries => {
    return {
      plan: {
        from: lib.extractFromElement(parsedEvent),
        itineraries: itineraries,
      },
    };
  });
};
