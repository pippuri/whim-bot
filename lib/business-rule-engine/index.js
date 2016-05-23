
var defaultServiceBus = require('../../lib/service-bus/index.js');

var Promise = require('bluebird');
var haversine = require('haversine');

var businessRuleDatabase = {
  plan1: {
    bus: true,
    taxi: false,
  },
  plan2: {
    bus: true,
    taxi: true,
  },
};

var providerRegions = {
  tripgo: [
    {
      area: [59.74, 22.65, 61.99, 30.24],
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

function getPolicy(plans) {
  return new Promise((resolve, reject) => {
    var policy = {
      bus: false,
      taxi: false,
    };
    for (var i of Object.keys(plans)) {
      var plan = plans[i];
      if (!businessRuleDatabase.hasOwnProperty(plan)) {
        return reject(new Error('Unknown plan: ' + plan));
      }

      var spec = businessRuleDatabase[plan];

      if (spec.bus === true) {
        policy.bus = true;
      }

      if (spec.taxi === true) {
        policy.taxi = true;
      }

    }

    return resolve(policy);
  });
}

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

function resolveRoutesProvider(event, options) {
  return new Promise((resolve, reject) => {
    var provider;

    if (typeof options === typeof {} && options.hasOwnProperty('provider')) {
      provider = options.provider;
    } else {
      provider = 'tripgo';
    }

    var subProvider = chooseProviderByRegion(provider, event.from);
    var functionName = 'MaaS-provider-' + provider + '-routes' + subProvider;
    return resolve(functionName);
  });
}

function haversineLength(leg) {

  if (!leg.hasOwnProperty(leg.from)) {
    return 0;
  }

  if (!leg.hasOwnProperty(leg.to)) {
    return 0;
  }

  var start = {
    latitude: leg.from.lat,
    longitude: leg.from.lon,
  };
  var end = {
    latitude: leg.to.lat,
    longitude: leg.to.lon,
  };
  return haversine(start, end);
}

function calculateLegCo2(leg) {

  // The co2 costs are taken from the following source in a hurry.
  // Better number might be available from other sources or even from the same source.
  // https://www.gov.uk/government/uploads/system/uploads/attachment_data/file/69314/pb13625-emission-factor-methodology-paper-110905.pdf

  var co2Costs = {
    WALK: 0,
    BICYCLE: 0,
    CAR: 204.6,
    TRAM: 71.5,
    SUBWAY: 73.6,
    RAIL: 56.5,
    BUS: 148.8,
    FERRY: 19.3,
    CABLE_CAR: null,
    GONDOLA: 0,
    FUNICULAR: null,
    TRANSIT: null,
    TRAINISH: null,
    BUSISH: null,
    LEG_SWITCH: 0,
    TAXI: 151.5,
  };

  var transport = leg.mode;

  if (!co2Costs.hasOwnProperty(transport)) {
    return 0;
  }

  var cost = co2Costs[transport];
  if (cost === null) {
    return null;
  }

  var co2 = haversineLength(leg) * cost;
  return co2;
}

function calculateItineraryCo2(itinerary) {
  var co2Cost = 0;
  for (var leg of itinerary.legs) {
    var legCo2 = calculateLegCo2(leg);
    if (legCo2 === null) {
      return null;
    }

    co2Cost += legCo2;
  }

  return co2Cost;
}

function addLegCosts(routes, policy) {
  for (var itinerary of routes.plan.itineraries) {
    itinerary.fare = {
      co2: calculateItineraryCo2(itinerary),
    };
  }
}

module.exports = {
  call: (ruleObject, options) => {
    var serviceBus;

    if (typeof options === typeof {}) {
      if (typeof options.serviceBus === typeof defaultServiceBus) {
        serviceBus = options.serviceBus;
      } else {
        serviceBus = defaultServiceBus;
      }
    }

    if (ruleObject.rule === 'get-routes') {
      var routesPromise = resolveRoutesProvider(ruleObject.parameters, ruleObject.options)
      .then(service => serviceBus.call(service, ruleObject.parameters));

      var policyPromise = serviceBus.call('MaaS-database-context-get', { principalId: ruleObject.identityId })
      .then(context => getPolicy(context.activePlans));

      return Promise.all([
        routesPromise,
        policyPromise,
      ])
      .then(all => new Promise((resolve, reject) => {
        var routes = all[0];
        var policy = all[1];
        addLegCosts(routes, policy);
        return resolve(routes);
      }));
    }

    return Promise.reject(new Error('unknown rule ' + ruleObject.rule));
  },
};
