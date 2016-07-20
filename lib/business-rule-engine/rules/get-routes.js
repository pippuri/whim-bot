'use strict';

const units = require('../lib/priceUnits');
const pricelistDatabase = require('../lib/pricelistDatabase.js');
const gju = require('geojson-utils');
const haversine = require('haversine');
const _ = require('lodash');
const powerset = require('powerset');
const _case = require('case-expression');
const _default = () => true;
const lib = require('../lib/index');
const Promise = require('bluebird');

function setProviders(routes) {

  const TAXI_PROVIDER = 'Valopilkku';
  const TRAIN_PROVIDER = 'HSL';

  // TODO: Have a better mechanism for referring to Valopilkku
  const configurations = pricelistDatabase.pricelist0.prices;
  const taxiConfiguration = _.find(configurations, { agency: 'Valopilkku' });
  const trainConfigurations = _.filter(configurations, { agency: 'HSL' });

  routes.plan.itineraries.forEach(itinerary => {
    itinerary.legs.forEach(leg => {
      if (leg.mode === 'TAXI') {
        const legFrom = {
          type: 'Point',
          coordinates: [leg.from.lat, leg.from.lon],
        };
        const legTo = {
          type: 'Point',
          coordinates: [leg.to.lat, leg.to.lon],
        };
        const specArea = {
          type: 'MultiPolygon',
          coordinates: taxiConfiguration.area,
        };

        // Only permit Valopilkku in Finland
        if (!gju.pointInMultiPolygon(legFrom, specArea) || !gju.pointInMultiPolygon(legTo, specArea)) {
          return;
        }

        leg.agencyId = TAXI_PROVIDER;
        return;
      }

      if (leg.mode === 'TRAIN') {
        const HKI_TRAINS = ['I', 'K', 'N', 'R', 'T', 'Z',
         'A', 'E', 'L', 'P', 'U', 'X', 'Y'];

        if (!HKI_TRAINS.find(route => route === leg.route)) {
          return;
        }

        trainConfigurations.find(config => {
          const legFrom = {
            type: 'Point',
            coordinates: [leg.from.lat, leg.from.lon],
          };
          const legTo = {
            type: 'Point',
            coordinates: [leg.to.lat, leg.to.lon],
          };
          const specArea = {
            type: 'MultiPolygon',
            coordinates: config.area,
          };

          // If the area fits in configuration, accept it.
          if (!gju.pointInMultiPolygon(legFrom, specArea) || !gju.pointInMultiPolygon(legTo, specArea)) {
            return false;
          }

          leg.agencyId = TRAIN_PROVIDER;
          return true;
        });
      }
    });
  });
}

function resolveRoutesProvider(event) {
  const provider = 'tripgo';
  const functionName = 'MaaS-provider-' + provider + '-routes';
  return Promise.resolve(functionName);
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

function getApplicablePrices(leg, index, prices) {

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

    // If the time window is wrong, don't use the ticket
    const now = Date.now();
    const payableUntil = now + priceSpec.payableUntil;
    const bookableUntil = now + priceSpec.bookableUntil;

    // Don't book a leg that we don't dare to pay right away or book well in advance
    // Accept the special case of first leg.
    if (index === 0 || (leg.startTime > payableUntil && leg.startTime < bookableUntil)) {
      console.log(`Skipping unschedulable leg on ${leg.startTime} for ${leg.agencyId}, ${leg.startTime > payableUntil}, ${leg.startTime < bookableUntil}`);
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
      throw new Error('Unknown ticket specification type');
    },

  ]);

}

function calculateLegTicketOptions(leg, index, prices) {
  const applicablePrices = getApplicablePrices(leg, index, prices);
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
  const ticketOptionsForLegs = itinerary.legs.map((leg, index) => {
    return calculateLegTicketOptions(leg, index, prices);
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
  .then(context => lib.getUserSpecificPrices(context));

  return Promise.all([
    routesPromise,
    pricesPromise,
  ])
  .spread((routes, prices) => {
    setProviders(routes);
    addLegCosts(routes, prices);
    return Promise.resolve(routes);
  });
}

module.exports = {
  getRoutes,
};