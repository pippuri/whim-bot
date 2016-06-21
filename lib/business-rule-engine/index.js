'use strict';

const defaultServiceBus = require('../../lib/service-bus/index.js');

const Promise = require('bluebird');
const haversine = require('haversine');
const gju = require('geojson-utils');
const powerset = require('powerset');
const _case = require('case-expression');
const _default = () => true;
const _ = require('lodash');

const units = require('./priceUnits.js');
const pricelistDatabase = require('./pricelistDatabase.js');

function setProviders(routes) {

  const TAXI_PROVIDER = 'Valopilkku'; // TODO: Select taxi provider based on region

  routes.plan.itineraries.forEach(itinerary => {
    itinerary.legs.forEach(leg => {
      if (leg.mode === 'TAXI') {
        leg.agencyId = TAXI_PROVIDER;
      }

    });
  });
}

function getUserSpecificPrices(context) {

  // TODO make basePricelistIds configurable

  const basePricelistIds = ['pricelist0'];

  // TODO read userSpecificPricelistIds from context

  const userSpecificPricelistIds = ['pricelist2'];

  const applicablePricelistIds = basePricelistIds.concat(userSpecificPricelistIds);
  const prices = _.flatten(applicablePricelistIds.map(pricelistId => pricelistDatabase[pricelistId].prices));
  return prices;
}

function resolveRoutesProvider(event) {
  return new Promise((resolve, reject) => {
    const provider = 'tripgo';
    const functionName = 'MaaS-provider-' + provider + '-routes';
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

  const start = {
    latitude: leg.from.lat,
    longitude: leg.from.lon,
  };
  const end = {
    latitude: leg.to.lat,
    longitude: leg.to.lon,
  };
  return haversine(start, end);
}

function calculateLegCo2(leg) {

  // The co2 costs are taken from the following source in a hurry.
  // Better number might be available from other sources or even from the same source.
  // https://www.gov.uk/government/uploads/system/uploads/attachment_data/file/69314/pb13625-emission-factor-methodology-paper-110905.pdf

  const co2Costs = {
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

  const transport = leg.mode;

  if (!co2Costs.hasOwnProperty(transport)) {
    return 0;
  }

  const cost = co2Costs[transport];
  if (cost === null) {
    return null;
  }

  const co2 = haversineLength(leg) * cost;
  return co2;
}

function calculateItineraryCo2(itinerary) {
  let co2Cost = 0;
  for (let leg of itinerary.legs) { // eslint-disable-line prefer-const
    const legCo2 = calculateLegCo2(leg);
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
      type: units.U_NA,
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

    units.U_PMIN, () => {
      return createPMinTicketOption(leg, priceSpec);
    },

    units.U_PITI, () => {
      return createPItineraryTicketOption(priceSpec);
    },

    units.U_NA, () => {
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
    if (ticket.type === units.U_PMIN) {
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
  for (let legTicketOptions of ticketOptionsForLegs) { // eslint-disable-line prefer-const
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
  for (let itinerary of routes.plan.itineraries) { // eslint-disable-line prefer-const
    itinerary.fare = {
      points: calculateItineraryCost(itinerary, prices),
      co2: calculateItineraryCo2(itinerary),
    };
  }
}

function getRoutes(serviceBus, identityId, parameters) {
  const routesPromise = resolveRoutesProvider(parameters)
  .then(service => serviceBus.call(service, parameters));

  const pricesPromise = serviceBus.call('MaaS-profile-info', { identityId: identityId })
  .then(context => getUserSpecificPrices(context));

  return Promise.all([
    routesPromise,
    pricesPromise,
  ])
  .then(all => new Promise((resolve, reject) => {
    const routes = all[0];
    const prices = all[1];
    setProviders(routes);
    addLegCosts(routes, prices);
    return resolve(routes);
  }));
}

function callGetRoutes(serviceBus, ruleObject) {
  return getRoutes(serviceBus, ruleObject.identityId, ruleObject.parameters);
}

function call(ruleObject, options) {
  let serviceBus;

  if (typeof options === typeof {} && typeof options.serviceBus === typeof defaultServiceBus) {
    serviceBus = options.serviceBus;
  } else {
    serviceBus = defaultServiceBus;
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
