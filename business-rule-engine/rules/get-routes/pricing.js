'use strict';

const Promise = require('bluebird');
const powerset = require('powerset');
const _ = require('lodash');
const getTspPricingRules = require('../get-tsp-pricing');
const BusinessRuleError = require('../../BusinessRuleError.js');

const tspData = {
  dev: require('../../../lib/tsp/tspData-dev.json'),
  test: require('../../../lib/tsp/tspData-alpha.json'),
  alpha: require('../../../lib/tsp/tspData-alpha.json'),
  prod: require('../../../lib/tsp/tspData-prod.json'),
}[process.env.SERVERLESS_STAGE];
const PURCHASABLE_AGENCY_IDS = Object.keys(tspData);
const MODES_WITHOUT_TICKET = ['WALK', 'BICYCLE', 'TRANSFER', 'WAIT', 'LEG_SWITCH'];

/**
 * Calculate co2 cost for a leg
 * @param leg {Object} input leg, contains from-to location ...
 * @return co2 {Int} rounded down co2 cost of the leg
 */
function _calculateLegCo2(leg) {

  // The co2 costs are taken from the following source in a hurry.
  // Better number might be available from other sources or even from the same source.
  // https://www.gov.uk/government/uploads/system/uploads/attachment_data/file/69314/pb13625-emission-factor-methodology-paper-110905.pdf

  const co2Costs = {
    WALK: 0,
    BICYCLE: 0,
    CAR: 180.6,
    TRAM: 5.0,
    SUBWAY: 4.0,
    RAIL: 3.5,
    BUS: 35.8,
    FERRY: 19.3,
    CABLE_CAR: 6.5,
    GONDOLA: 8.0,
    FUNICULAR: 7.0,
    TRANSIT: null,
    TRAINISH: null,
    BUSISH: null,
    LEG_SWITCH: 0,
    TAXI: 130.0,
  };

  const transport = leg.mode;

  if (!co2Costs.hasOwnProperty(transport)) {
    return 0;
  }

  const cost = co2Costs[transport];

  if (cost === null) {
    return null;
  }

  let distance = 0;
  if (leg.hasOwnProperty('distance') && leg.distance !== undefined) {
    distance = leg.distance / 1000;
  }

  const co2 = distance * cost * 1.2;
  return Math.floor(co2);
}

/**
 * Calculate co2 cost for an itinerary by summing up all leg co2 cost
 * @param ititnerary {Object} Input itinerary
 * @return cost {Int} itinerary co2 cost
 */
function _calculateItineraryCo2(itinerary) {
  let co2Cost = 0;

  itinerary.legs.forEach(leg => {
    const legCo2 = _calculateLegCo2(leg);
    if (legCo2 === null) {
      co2Cost += 0;
    } else {
      co2Cost += Math.floor(legCo2);
    }
  });

  return co2Cost;
}

function _getApplicablePrices(leg, providers) {
  // Walking etc. legs are free
  if (MODES_WITHOUT_TICKET.some(mode => mode === leg.mode)) {
    return [{ type: 'U_NA' }];
  }

  return providers
    .map(provider => provider.providerMeta);
}

function _createNotApplicableTicket(priceSpec) {
  const freeTicket = {
    type: priceSpec.type,
    cost: 0,
  };

  return freeTicket;
}

function _createPerMinTicket(leg, priceSpec) {

  const pmin = priceSpec.value;
  const durationInMin = Math.ceil(((leg.endTime - leg.startTime) / 1000) / 60);
  const floor = priceSpec.baseValue ? priceSpec.baseValue : 0;

  const ticket = {
    type: priceSpec.type,
    cost: (durationInMin * pmin) + floor,
    agencyId: priceSpec.agencyId,
  };

  return ticket;
}

function _createPerKmTicket(leg, priceSpec) {

  const pricePkm = priceSpec.value;
  const distance = Math.ceil(leg.distance / 1000); // distance is in meters
  const basePrice = priceSpec.baseValue ? priceSpec.baseValue : 0;

  const ticket = {
    type: priceSpec.type,
    cost: basePrice + (distance * pricePkm),
    agencyId: priceSpec.agencyId,
  };
  return ticket;
}

function _createPerItineraryTicket(priceSpec) {

  const piti = priceSpec.value;

  const ticket = {
    type: priceSpec.type,
    cost: piti,
    agencyId: priceSpec.agencyId,
  };

  return ticket;
}

/**
 * Create ticket based on priceSpec type
 * Types are U_PMIN, U_PITI, U_PKM, U_NA ...
 * @param leg {Object}
 * @param priceSpec {Object}
 * @return ticket {Object} type{String} + cost{Float} + agencyId{String - optional}
 */
function _createTicket(leg, priceSpec) {
  switch (priceSpec.type) {
    case 'U_PMIN':
      return _createPerMinTicket(leg, priceSpec);
    case 'U_PITI':
      return _createPerItineraryTicket(priceSpec);
    case 'U_PKM':
      return _createPerKmTicket(leg, priceSpec);
    case 'U_NA':
      return _createNotApplicableTicket(priceSpec);
    default:
      throw new BusinessRuleError(`Unknown ticket specification type: ${JSON.stringify(priceSpec)}`, 500, 'get-routes');
  }
}

/**
 * Create ticket options for the leg that have applicable prices
 * @param leg {Object}
 * @param index {Int}
 * @param tspPrices {}
 */
function _getLegTicketOptions(leg, providers) {
  const applicablePrices = _getApplicablePrices(leg, providers);
  const ticketOptions = applicablePrices.map(spec => _createTicket(leg, spec));
  return ticketOptions;
}

function _uniqueTickets(tickets) {

  const emptyGroups = { leg: [], itinerary: [] };
  const ticketsByExpiration = _.merge(emptyGroups, _.groupBy(tickets, ticket => {
    if (ticket.type === 'U_PMIN') {
      return 'leg';
    }
    if (ticket.type === 'U_PKM') {
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

function _isLegTraversableWithTickets(legTicketOption, ticketCombo) {
  const suitableTickets = _.intersectionWith(legTicketOption, ticketCombo, _.isEqual);
  const isTraversable = (suitableTickets.length > 0);
  return isTraversable;
}

function _isItineraryTraversableWithTickets(ticketOptionsForLegs, ticketCombo) {
  for (let option of ticketOptionsForLegs) { // eslint-disable-line prefer-const
    if (!_isLegTraversableWithTickets(option, ticketCombo)) {
      return false;
    }
  }

  return true;
}

// FIXME figure out how to ensure the taxi leg cost is always included as a ticket
function _calculateItineraryCost(itinerary, providers) {

  // Save the leg agencyId to ensure ticket's presence in the end
  const requiredProviders = _.uniq(
    itinerary.legs
      .map(leg => leg.agencyId)
      .filter(agencyId => agencyId !== '' && agencyId)
  );

  const ticketOptionsForLegs = itinerary.legs.map(leg => {
    return _getLegTicketOptions(leg, providers);
  });

  const allTickets = _.flatten(ticketOptionsForLegs);

  const ticketCandidates = _uniqueTickets(allTickets);
  const ticketCombos = powerset(ticketCandidates);

  const applicableTicketCombos = ticketCombos.filter(ticketCombo => {
    return _isItineraryTraversableWithTickets(ticketOptionsForLegs, ticketCombo);
  });

  if (applicableTicketCombos.length < 1) {
    return null;
  }

  const combosByCost = _.sortBy(applicableTicketCombos, ticketCombo => {
    return _.sumBy(ticketCombo, 'cost');
  });

  let cheapestCombo;
  // Loop through the combosByCost and find the first item to have all requiredProviders
  for (let i = 0; i < combosByCost.length; i++) {
    cheapestCombo = combosByCost[i];

    const cheapestComboProviders = cheapestCombo.map(item => item.agencyId).filter(agencyId => agencyId !== '' && agencyId);

    const check = _.intersectionWith(requiredProviders, cheapestComboProviders, (a, b) => {
      return b.indexOf(a) >= 0;
    });

    if (check.length === requiredProviders.length) {
      break;
    }
  }

  const cost = _.sumBy(cheapestCombo, 'cost');
  return cost;
}

/**
 * Decide which provider from the list of possible provider to handle the leg
 */
function _setBookingProviders(itinerary, providers) {
  itinerary.legs.forEach(leg => {
    if (!leg.agencyId) {
      return;
    }

    const booker = providers.find(provider => {
      return provider.agencyId === leg.agencyId;
    });

    if (!booker) return;

    leg.agencyId = booker.agencyId;
  });
}

/**
 * Calculate costs in points and co2 for all itineraries based on pricing
 */
function _calculateCost(itineraries, profile) {
  // Create a list of agencies we want to price
  const bookingAgencies = {};
  itineraries.forEach(itinerary => {
    itinerary.legs.forEach(leg => {
      // If the leg has an agency for a bookable leg, add it to our query
      const agencyId = leg.agencyId;
      if (agencyId && !bookingAgencies[agencyId] && !MODES_WITHOUT_TICKET.some(mode => mode === leg.mode)) {
        const query = {
          agencyId: agencyId,
          from: leg.from,
          to: leg.to,
        };
        bookingAgencies[agencyId] = query;
      }
    });
  });

  return getTspPricingRules.getOptionsBatch(_.values(bookingAgencies), profile)
    .then(providers => {
      // Filter null responses (e.g. no provider found)
      const filteredProviders = providers.filter(provider => provider !== null);

      itineraries.forEach(itinerary => {
        _setBookingProviders(itinerary, filteredProviders);
        itinerary.fare = {
          points: _calculateItineraryCost(itinerary, filteredProviders),
          co2: _calculateItineraryCo2(itinerary),
        };
      });

      return Promise.resolve(itineraries);
    });
}

/**
 * If received multiple Taxi leg, use only those that cost less
 */
function _filterOutMultipleTaxiItineraries(itineraries) {
  // Move all non taxi itineraries to an array
  const newItinerariesSet = itineraries.filter(itinerary => itinerary.legs.every(leg => leg.mode !== 'TAXI'));

  // Move all taxi itineraries to an array and get the cheapest one
  const taxiItineraries = itineraries.filter(itinerary => itinerary.legs.some(leg => leg.mode === 'TAXI'));

  if (taxiItineraries.length === 0) {
    // If no taxi route available, skip finding the cheapest taxi route return itineraries
    return itineraries;
  }

  const cheapestTaxiRoute = taxiItineraries.sort((a, b) => a.fare.points - b.fare.points)[0];
  newItinerariesSet.push(cheapestTaxiRoute);

  return newItinerariesSet;
}

function _nullifyUnpurchasableItineraries(itineraries) {
  itineraries.forEach(itinerary => {
    itinerary.legs.forEach(leg => {
      // If leg doesn't have an agencyId and is not a WALK / WAIT / TRANSFER leg, make itinerary unpurchasable
      if (leg.agencyId && PURCHASABLE_AGENCY_IDS.indexOf(leg.agencyId) === -1) {
        itinerary.fare.points = null;
      }

      if (!leg.agencyId && (['WALK', 'WAIT', 'TRANSFER'].indexOf(leg.mode)) === -1) {
        itinerary.fare.points = null;
      }
    });
  });
  return itineraries;
}

function resolveRoutesPrice(itineraries, profile) {
  return _calculateCost(itineraries, profile)
    .then(itineraries => _nullifyUnpurchasableItineraries(itineraries))
    .then(itineraries => _filterOutMultipleTaxiItineraries(itineraries));
}

module.exports = {
  resolveRoutesPrice,
};
