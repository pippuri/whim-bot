
var defaultServiceBus = require('../../lib/service-bus/index.js');

var Promise = require('bluebird');
var haversine = require('haversine');
var gju = require('geojson-utils');
var powerset = require('powerset');
var _case = require('case-expression');
var _default = () => true;
var _ = require('lodash');

const U_NA = 'n/a';
const U_PMIN = 'p/min';
const U_PITI = 'p/itinerary';

// jscs:disable disallowSpacesInsideBrackets
// jscs:disable disallowSpacesInsideArrayBrackets

// TODO business people should be able to add new plans to the database.

const pricelistDatabase = {
  pricelist0: {
    title: 'Base pricelist.',
    prices: [
      {
        agency: 'HSL',
        name: 'Helsinki',
        value: 73,
        type: U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.2549956, 24.8277603], // 4. Shell, Torpantie 4, Vantaa
              [60.3005963, 25.2829841], // 5. Arla, Kotkantie 34, Söderkulla
              [60.1533034, 25.2836792], // 8. Trutlande island
              [60.1245699, 24.8466468], // 7. Harmaakari island
            ],
          ],
        ],
      },
      {
        agency: 'HSL',
        name: 'Espoo',
        value: 73,
        type: U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.3371203, 24.8258768], // 2. Betomix Oy, Vanha Nurmijärventie 188, Vantaa
              [60.1245699, 24.8466468], // 7. Harmaakari island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
      {
        agency: 'HSL',
        name: 'Vantaa',
        value: 73,
        type: U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.3371203, 24.8258768], // 2. Betomix Oy, Vanha Nurmijärventie 188, Vantaa
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.3005963, 25.2829841], // 5. Arla, Kotkantie 34, Söderkulla
              [60.2549956, 24.8277603], // 4. Shell, Torpantie 4, Vantaa
            ],
          ],
        ],
      },
      {
        agency: 'HSL',
        name: 'Seutu',
        value: 113,
        type: U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
      {
        agency: 'Valopilkku',
        name: 'Taksi',
        value: 29,
        type: U_PMIN,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
    ],
  },
  pricelist1: {
    title: 'Helsinki plan prices.',
    prices: [
      {
        agency: 'HSL',
        name: 'Helsinki',
        value: 0,
        type: U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.2549956, 24.8277603], // 4. Shell, Torpantie 4, Vantaa
              [60.3005963, 25.2829841], // 5. Arla, Kotkantie 34, Söderkulla
              [60.1533034, 25.2836792], // 8. Trutlande island
              [60.1245699, 24.8466468], // 7. Harmaakari island
            ],
          ],
        ],
      },
      {
        agency: 'Valopilkku',
        name: 'Taksi',
        value: 29,
        type: U_PMIN,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
    ],
  },
  pricelist2: {
    title: 'Seutu plan prices.',
    prices: [
      {
        agency: 'HSL',
        name: 'Seutu Plan',
        value: 0,
        type: U_PITI,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
      {
        agency: 'Valopilkku',
        name: 'Taksi',
        value: 29,
        type: U_PMIN,
        area: [ // multiPolygon
          [     // polygon
            [   // exterrior
              [60.5345547, 24.2311627], // 1. S-Market, Mäntylänkatu 1, Karkkila
              [60.4330613, 25.2609861], // 3. Södra Paipis Skola, Koulumäki, Paippinen
              [60.1533034, 25.2836792], // 8. Trutlande island
              [59.9285049, 24.2616823], // 6. Norrklobben island
            ],
          ],
        ],
      },
    ],
  },
};

// jscs:enable disallowSpacesInsideArrayBrackets
// jscs:enable disallowSpacesInsideBrackets

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

function getUserSpecificPrices(context) {

  // TODO make basePricelistIds configurable

  const basePricelistIds = ['pricelist0'];

  // TODO read userSpecificPricelistIds from context

  const userSpecificPricelistIds = ['pricelist2'];

  const applicablePricelistIds = basePricelistIds.concat(userSpecificPricelistIds);
  const prices = _.flatten(applicablePricelistIds.map(pricelistId => pricelistDatabase[pricelistId].prices));
  return prices;
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

function getApplicablePrices(leg, prices) {

  const modesWithoutTickets = [
   'WALK',
   'BICYCLE',
   'TRANSFER',
   'WAIT',
  ];

  if (_.includes(modesWithoutTickets, leg.mode)) {
    const spec = {
      type: U_NA,
    };

    return [spec];
  }

  const applicablePrices = prices.filter(priceSpec => {

    if (priceSpec.agency !== leg.agencyId) {
      return false;
    }

    const specArea = {
      type: 'MultiPolygon',
      coordinates: priceSpec.area,
    };

    const legFrom = {
      type: 'Point',
      coordinates: [leg.from.lat, leg.from.lon],
    };
    const legTo = {
      type: 'Point',
      coordinates: [leg.to.lat, leg.to.lon],
    };

    if (!gju.pointInMultiPolygon(legFrom, specArea)) {
      return false;
    }

    if (!gju.pointInMultiPolygon(legTo, specArea)) {
      return false;
    }

    return true;

  });

  return applicablePrices;

}

function createNotApplicableTicketOption(priceSpec) {
  const freeTicket = {
    type: priceSpec.type,
    cost: 0,
  };

  return freeTicket;
}

function createPMinTicketOption(leg, priceSpec) {
  const pmin = priceSpec.value;
  const duration = (leg.endTime - leg.startTime);
  const minutes = (duration / 1000) / 60;
  const ceiling = Math.ceil(minutes);
  const ticketOption = {
    type: priceSpec.type,
    cost: ceiling * pmin,
    area: priceSpec.area,
    agency: priceSpec.agency,
  };

  return ticketOption;
}

function createPItineraryTicketOption(priceSpec) {
  const piti = priceSpec.value;
  const ticketOption = {
    type: priceSpec.type,
    cost: piti,
    area: priceSpec.area,
    agency: priceSpec.agency,
  };

  return ticketOption;
}

function createTicketOption(leg, priceSpec) {

  return _case(priceSpec.type, [

    U_PMIN, () => {
      return createPMinTicketOption(leg, priceSpec);
    },

    U_PITI, () => {
      return createPItineraryTicketOption(priceSpec);
    },

    U_NA, () => {
      return createNotApplicableTicketOption(priceSpec);
    },

    _default, () => {
      throw 'Unknown ticket specification type';
    },

  ]);

}

function calculateLegTicketOptions(leg, prices) {

  const applicablePrices = getApplicablePrices(leg, prices);
  const ticketOptions = applicablePrices.map(spec => createTicketOption(leg, spec));
  return ticketOptions;

}

function uniqueTickets(tickets) {

  const emptyGroups = { leg: [], itinerary: [] };
  const ticketsByExpiration = _.merge(emptyGroups, _.groupBy(tickets, ticket => {
    if (ticket.type === U_PMIN) {
      return 'leg';
    }

    return 'itinerary';
  }));

  const legTickets = ticketsByExpiration.leg;
  const itineraryTickets = ticketsByExpiration.itinerary;

  // All single legs are unique regardless of similarity of the ticket objects

  const uniqueLegTickets = legTickets;

  // Itinerary tickets are duplicates if the contents of the ticket objects match

  const uniqueItineraryTickets = _.uniqWith(itineraryTickets, _.isEqual);

  const uniqueTickets = uniqueLegTickets.concat(uniqueItineraryTickets);
  return uniqueTickets;
}

function isLegTraversableWithTickets(legTicketOptions, ticketCombo) {
  const suitableTickets = _.intersectionWith(legTicketOptions, ticketCombo, _.isEqual);
  const isTraversable = (suitableTickets.length > 0);
  return isTraversable;
}

function isItineraryTraversableWithTickets(ticketOptionsForLegs, ticketCombo) {
  for (var legTicketOptions of ticketOptionsForLegs) {
    if (!isLegTraversableWithTickets(legTicketOptions, ticketCombo)) {
      return false;
    }
  }

  return true;
}

function calculateItineraryCost(itinerary, prices) {
  const ticketOptionsForLegs = itinerary.legs.map(leg => {
    return calculateLegTicketOptions(leg, prices);
  });
  const allTickets = _.flatten(ticketOptionsForLegs);
  const ticketCandidates = uniqueTickets(allTickets);
  const ticketCombos = powerset(ticketCandidates);

  const applicableTicketCombos = ticketCombos.filter(ticketCombo => {
    return isItineraryTraversableWithTickets(ticketOptionsForLegs, ticketCombo);
  });

  if (applicableTicketCombos.length < 1) {
    return null;
  }

  const combosByCost = _.sortBy(applicableTicketCombos, ticketCombo => {
    return _.sumBy(ticketCombo, 'cost');
  });

  const cheapestCombo = combosByCost[0];
  const cost = _.sumBy(cheapestCombo, 'cost');
  return cost;
}

function addLegCosts(routes, prices) {
  for (var itinerary of routes.plan.itineraries) {
    itinerary.fare = {
      points: calculateItineraryCost(itinerary, prices),
      co2: calculateItineraryCo2(itinerary),
    };
  }
}

function getRoutes(serviceBus, identityId, parameters, options) {
  var routesPromise = resolveRoutesProvider(parameters, options)
  .then(service => serviceBus.call(service, parameters));

  var pricesPromise = serviceBus.call('MaaS-profile-info', { identityId: identityId })
  .then(context => getUserSpecificPrices(context));

  return Promise.all([
    routesPromise,
    pricesPromise,
  ])
  .then(all => new Promise((resolve, reject) => {
    const routes = all[0];
    const prices = all[1];
    addLegCosts(routes, prices);
    return resolve(routes);
  }));
}

function callGetRoutes(serviceBus, ruleObject) {
  var options = {};
  if (ruleObject.hasOwnProperty('options') && ruleObject.options.hasOwnProperty('provider')) {
    options.provider = ruleObject.options.provider;
  }

  return getRoutes(serviceBus, ruleObject.identityId, ruleObject.parameters, options);
}

function call(ruleObject, options) {
  var serviceBus;

  if (typeof options === typeof {}) {
    if (typeof options.serviceBus === typeof defaultServiceBus) {
      serviceBus = options.serviceBus;
    } else {
      serviceBus = defaultServiceBus;
    }
  }

  return _case(ruleObject.rule, [

    'get-routes', () => {
      return callGetRoutes(serviceBus, ruleObject);
    },

    _default, () => {
      return Promise.reject(new Error('unknown rule ' + ruleObject.rule));
    },

  ]);

}

module.exports = {
  call: call,
};
