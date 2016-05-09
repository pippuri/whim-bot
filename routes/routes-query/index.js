var crypto = require('crypto');
var contextStore = require('../../lib/context-store/store.js');
var businessRuleEngine = require('../../lib/business-rule-engine/index.js');
var serviceBus = require('../../lib/service-bus/index.js');

// Generate a unique route identifier by hashing the JSON
function generateRouteId(itinerary) {
  var hash = crypto.createHash('sha1');
  hash.update(JSON.stringify(itinerary));
  return hash.digest('hex');
}

// Generate a unique leg identifier by hashing the JSON
function generateLegId(leg) {
  var hash = crypto.createHash('sha1');
  hash.update(JSON.stringify(leg));
  return hash.digest('hex');
}

// Add route and leg identifiers to itineraries that don't yet have them
// Identifiers may already have been added by individual providers
function addRouteAndLegIdentifiers(itineraries) {
  itineraries.map(function (itinerary) {
    if (!itinerary.routeId) {
      itinerary.routeId = generateRouteId(itinerary);
    }

    (itinerary.legs || []).map(function (leg) {
      if (!leg.legId) {
        leg.legId = generateLegId(leg);
      }
    });
  });
}

function getRoutes(principalId, provider, from, to, leaveAt, arriveBy) {
  var options = {};
  if (typeof provider !== typeof undefined) {
    options.provider = provider;
  }

  return contextStore.get(principalId)
  .then((context) => businessRuleEngine.get(context.activePlans))
  .then((policy) => serviceBus.getRoutes(from, to, leaveAt, arriveBy, options))
  .then((payload) => {
    addRouteAndLegIdentifiers(payload.plan.itineraries || []);
    return payload;
  });
}

module.exports.respond = function (event, callback) {
  if (!event.principalId) {
    callback(new Error('Authorization error.'));
  } else if (!event.from) {
    callback(new Error('Missing "from" argument.'));
  } else if (!event.to) {
    callback(new Error('Missing "to" argument.'));
  } else if (event.leaveAt && event.arriveBy) {
    callback(new Error('Both "leaveAt" and "arriveBy" provided.'));
  } else {
    getRoutes(event.principalId, event.provider, event.from, event.to, event.leaveAt, event.arriveBy)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
  }

};
