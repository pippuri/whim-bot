'use strict';

function filterOutUnpurchasableItinerary(itineraries) {
  return itineraries.filter(itinerary => {
    return itinerary.fare.points !== null;
  });
}

// Chose
function decide(itineraries, keep) {

  if (!keep) {
    itineraries = filterOutUnpurchasableItinerary(itineraries);
  }

  return itineraries;
}

module.exports = {
  decide,
};
