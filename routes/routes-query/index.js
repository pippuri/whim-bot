var BBPromise = require('bluebird');
var crypto = require('crypto');
var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({ region:process.env.AWS_REGION });
BBPromise.promisifyAll(lambda, { suffix:'BBPromise' });

var providerRegions = {
  tripgo: [
    {
      area:[59.74, 22.65, 61.99, 30.24],
      subProvider: '-southfinland',
    },
    {
      area: [59.74, 19.31, 64.12, 29.93],
      subProvider: '-middlefinland',
    },
    {
      area: [61.72, 20, 70.36, 32.08],
      subProvider: '-northfinland',
    },
  ],
};

function isInsideRegion(coords, area) {
  return (area[0] <= coords[0] && coords[0] <= area[2] &&
    area[1] <= coords[1] && coords[1] <= area[3]);
}

function chooseProviderByRegion(provider, from) {
  var subProvider = '';
  var regions = providerRegions[provider];
  if (regions) {
    var coords = from.split(',').map(parseFloat);

    // Look for a sub-provider by matching region
    regions.map(function (region) {
      if (!subProvider && isInsideRegion(coords, region.area)) {
        subProvider = region.subProvider;
      }

    });

    if (!subProvider) {

      // Could not find a subprovider in the configured regions
      throw new Error('No provider found for region');
    }
  }

  return subProvider;
}

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

function getRoutes(provider, from, to, leaveAt, arriveBy) {
  if (!provider) {
    provider = 'tripgo';
  }

  var subProvider = chooseProviderByRegion(provider, from);
  var functionName = 'MaaS-provider-' + provider + '-routes' + subProvider;
  console.log('Invoking router', functionName);
  return lambda.invokeBBPromise({
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify({
      from: from,
      to: to,
      leaveAt: leaveAt,
      arriveBy: arriveBy,
    }),
  })
  .then(function (response) {
    var payload = JSON.parse(response.Payload);
    if (payload.error) {
      return BBPromise.reject(new Error(payload.error));
    } else if (payload.errorMessage) {
      return BBPromise.reject(new Error(payload.errorMessage));
    } else {

      // Add any missing route and leg identifiers to response
      addRouteAndLegIdentifiers(payload.plan.itineraries || []);

      // Add some debug info to response
      payload.maas = {
        provider: provider + subProvider,
      };
      return payload;
    }

  });
}

module.exports.respond = function (event, callback) {
  if (!event.from) {
    callback(new Error('Missing "from" argument.'));
  } else if (!event.to) {
    callback(new Error('Missing "to" argument.'));
  } else if (event.leaveAt && event.arriveBy) {
    callback(new Error('Both "leaveAt" and "arriveBy" provided.'));
  } else {
    getRoutes(event.provider, event.from, event.to, event.leaveAt, event.arriveBy)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
  }

};
