'use strict';

const Promise = require('bluebird');
const powerset = require('powerset');
const _ = require('lodash');
const getTspPricingRules = require('../get-tsp-pricing');
const maasOperation = require('../../../lib/maas-operation');
const tspDataDev = require('../../../lib/tsp/tspData-dev.json');
const tspDataAlpha = require('../../../lib/tsp/tspData-alpha.json');
const tspDataProd = require('../../../lib/tsp/tspData-prod.json');
let tspData;

switch (process.env.SERVERLESS_STAGE) {
  case 'alpha':
    tspData = tspDataAlpha;
    break;
  case 'prod':
    tspData = tspDataProd;
    break;
  case 'dev':
  case 'test':
  default:
    tspData = tspDataDev;
    break;
}

const purchasableAgencyId = Object.keys(tspData);
const MODE_WITHOUT_TICKET = ['WALK', 'BICYCLE', 'TRANSFER', 'WAIT'];

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

function _getApplicablePrices(leg, index, tspPrices) {
  if (MODE_WITHOUT_TICKET.indexOf(leg.mode) !== -1) {
    const spec = {
      type: 'U_NA',
    };

    return [spec];
  }

  const applicablePrices = tspPrices.filter(priceSpec => {
    if (!priceSpec) {
      return false;
    }

    // If the time window is wrong, don't use the ticket
    const payableUntil = Date.now() + priceSpec.payableUntil;
    const bookableUntil = Date.now() + priceSpec.bookableUntil;

    if (index === 0 || (leg.startTime > payableUntil && leg.startTime < bookableUntil)) {
      //console.info(`Might need to skip unschedulable leg on ${leg.startTime} for ${leg.agencyId}, ${leg.startTime > payableUntil}, ${leg.startTime < bookableUntil}`);
      // return false;
    }

    return true;
  });
  return applicablePrices.map(price => {
    return price.providerMeta;
  });
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
      throw new Error('Unknown ticket specification type');
  }
}

/**
 * TODO: replace this with a lambda call to check location etc
 */
function _getPointsPrices(identityId) { // eslint-disable-line
  return maasOperation.fetchCustomerProfile(identityId)
    .then(profile => Promise.resolve(
      {
        identityId: profile.identityId,
        level: 0,
        profile: profile,
      }
    ));
}

/**
 * Create ticket options for the leg that have applicable prices
 * @param leg {Object}
 * @param index {Int}
 * @param tspPrices {}
 */
function _getLegTicketOptions(leg, index, tspPrices) {
  const applicablePrices = _getApplicablePrices(leg, index, tspPrices);

  // spec includes ticket type
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
function _calculateItineraryCost(itinerary, tspPrices) {

  // Save the leg agencyId to ensure its ticket's presense in the end
  const requiredProviders = _.uniq(
    itinerary.legs
      .map(leg => leg.agencyId)
      .filter(agencyId => agencyId !== '' && agencyId)
  );

  const ticketOptionsForLegs = itinerary.legs.map((leg, index) => {
    return _getLegTicketOptions(leg, index, tspPrices);
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
  if (!itinerary || !itinerary.legs) return;
  if (!providers || providers.length < 1) return;

  itinerary.legs.forEach(leg => {
    if (!leg.agencyId) return;

    const booker = providers.find(provider => provider.agencyId.indexOf(leg.agencyId) > 0);
    if (!booker) return;

    leg.agencyId = booker.agencyId;
  });
}

/**
 * Calculate costs in points and co2 for all itineraries based on pricing
 */
function _calculateCost(itineraries, profile) {
  const bookingAgencies = {};
  itineraries.map(itinerary => {
    itinerary.legs.forEach(leg => {
      if (leg.agencyId && !bookingAgencies.hasOwnProperty(leg.agencyId) && !_.includes(MODE_WITHOUT_TICKET, leg.mode)) {
        bookingAgencies[leg.agencyId] = {
          agencyId: leg.agencyId,
          location: { from: leg.from, to: leg.to },
        };
      }
    });
  });
  return getTspPricingRules.getOptionsBatch(_.values(bookingAgencies), profile)
    .then(tspPrices => {

      tspPrices.map(price => {
        if (!price || !price.length) { return null; }
        return Object.assign({ agencyName: price[0].providerName }, price[0].providerMeta );
      });

      tspPrices = tspPrices.filter(x => {
        if (!x) {
          return false;
        }
        return true;
      });

      itineraries.map(itinerary => {
        _setBookingProviders(itinerary, tspPrices);
        itinerary.fare = {
          points: _calculateItineraryCost(itinerary, tspPrices),
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
  const cheapestTaxiRoute = taxiItineraries.sort((a, b) => a.fare.points - b.fare.points)[0];

  newItinerariesSet.push(cheapestTaxiRoute);
  return newItinerariesSet;
}

function _nullifyUnpurchasableItineraries(itineraries) {
  itineraries.forEach(itinerary => {
    itinerary.legs.forEach(leg => {
      // If leg doesn't have an agencyId and is not a WALK / WAIT / TRANSFER leg, make itinerary unpurchasable
      if (leg.agencyId && purchasableAgencyId.indexOf(leg.agencyId) === -1) {
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
