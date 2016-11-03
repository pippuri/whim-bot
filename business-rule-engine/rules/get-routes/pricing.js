'use strict';

const BusinessRuleError = require('../../BusinessRuleError.js');
const getTspPricingRules = require('../get-tsp-pricing');
const _intersectionWith = require('lodash/intersectionWith');
const _isEqual = require('lodash/isEqual');
const _flatten = require('lodash/flatten');
const _groupBy = require('lodash/groupBy');
const _merge = require('lodash/merge');
const _sortBy = require('lodash/sortBy');
const _sumBy = require('lodash/sumBy');
const _uniqWith = require('lodash/uniqWith');
const _values = require('lodash/values');
const Promise = require('bluebird');
const powerset = require('powerset');
const geoUtils = require('geojson-utils');
const utils = require('../../../lib/utils');

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

function _getTicketSpec(leg, providers) {
  // Walking etc. legs are free
  if (MODES_WITHOUT_TICKET.some(mode => mode === leg.mode)) {
    return [{ type: 'U_NA' }];
  }

  return providers.map(provider => {
    const ticketSpec = {
      ticketName: provider.ticketName,
      providerPrio: provider.providerPrio,
      type: provider.type,
      value: provider.value,
      baseValue: provider.baseValue,
      agencyId: provider.agencyId,
    };
    return ticketSpec;
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
    ticketName: priceSpec.ticketName,
    providerPrio: priceSpec.providerPrio,
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
    ticketName: priceSpec.ticketName,
    providerPrio: priceSpec.providerPrio,
    type: priceSpec.type,
    cost: basePrice + (distance * pricePkm),
    agencyId: priceSpec.agencyId,
  };
  return ticket;
}

function _createPerItineraryTicket(priceSpec) {

  const piti = priceSpec.value;

  const ticket = {
    ticketName: priceSpec.ticketName,
    providerPrio: priceSpec.providerPrio,
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
  const applicablePrices = _getTicketSpec(leg, providers);
  const ticketOptions = applicablePrices.map(spec => _createTicket(leg, spec));
  return ticketOptions;
}

function _uniqueTickets(tickets) {
  const emptyGroups = { leg: [], itinerary: [] };
  const ticketsByExpiration = _merge(emptyGroups, _groupBy(tickets, ticket => {
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

  const uniqueItineraryTickets = _uniqWith(itineraryTickets, _isEqual);

  const uniqueTickets = uniqueLegTickets.concat(uniqueItineraryTickets);
  return uniqueTickets;
}

function _isLegTraversableWithTickets(legTicketOption, ticketCombo) {
  const suitableTickets = _intersectionWith(legTicketOption, ticketCombo, _isEqual);
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

/**
 * Used to remove provider option that has been covered by another
 */
function _reduceProviders(providers) {
  // Then filter by ticketName and providerPrio to only get the unique ones
  providers = _uniqWith(providers, _isEqual);
  if (providers.length >= 1) {
    // Lastly remove all provider with same agencyId but higher prio, E.g: [1,2,3,4,5] -> [5]
    const requiredProvidersByAgencyId = _groupBy(providers, 'agencyId');
    // eslint-disable-next-line
    for (let key in requiredProvidersByAgencyId) {
      requiredProvidersByAgencyId[key] = requiredProvidersByAgencyId[key].reduce((previous, current) => {
        if (previous.agencyId === current.agencyId && previous.providerPrio < current.providerPrio) {
          return current;
        }

        return previous;
      });
    }
    providers = _values(requiredProvidersByAgencyId);
  }

  // If there are multiple of the same agencyId with different priority, get the one with lower priority
  // Because lower priority provider will cover higher priority provider

  return providers;
}

/**
 * Resolve the list of providers that is nessesarry inside the itinerary
 */
function _resolveRequiredProviders(itinerary) {
  // Save the leg agencyId, ticketName and priority to ensure ticket's presence and not redundant in the end
  // Also sort requiredProviders by providerPrio
  let requiredProviders = itinerary.legs
      .map(leg => {
        return {
          agencyId: leg.agencyId,
          ticketName: leg.agencyData ? leg.agencyData.ticketName : undefined,
          providerPrio: leg.agencyData ? leg.agencyData.providerPrio : undefined,
        };
      })
      .sort((a, b) => a.providerPrio > b.providerPrio)
      .filter(item => item.agencyId && item.ticketName);

  // Reduce providers that has been covered by others
  requiredProviders = _reduceProviders(requiredProviders);
  return requiredProviders;
}

/**
 * Calculate to sum cost of the itinerary
 */
function _calculateItineraryCost(itinerary) {
  const requiredProviders = _resolveRequiredProviders(itinerary);
  const itineraryTicketProviders = itinerary.legs.filter(leg => typeof leg.agencyData !== typeof undefined).map(leg => leg.agencyData);
  // Remove agencyData after use
  itinerary.legs.forEach(leg => {
    if (leg.agencyData) {
      delete leg.agencyData;
    }
  });

  const ticketOptionsForLegs = itinerary.legs.map(leg => {
    return _getLegTicketOptions(leg, itineraryTicketProviders);
  });

  const allTickets = _flatten(ticketOptionsForLegs);

  const ticketCandidates = _uniqueTickets(allTickets);
  const ticketCombos = powerset(ticketCandidates);
  const applicableTicketCombos = ticketCombos.filter(ticketCombo => {
    return _isItineraryTraversableWithTickets(ticketOptionsForLegs, ticketCombo);
  });

  if (applicableTicketCombos.length < 1) {
    return null;
  }

  const combosByCost = _sortBy(applicableTicketCombos, ticketCombo => {
    return _sumBy(ticketCombo, 'cost');
  });

  let cheapestCombo;
  // Loop through the combosByCost and find the first item to have all requiredProviders
  for (let i = 0; i < combosByCost.length; i++) {
    cheapestCombo = combosByCost[i];

    let cheapestComboProviders = cheapestCombo.map(item => {
      return { agencyId: item.agencyId, ticketName: item.ticketName, providerPrio: item.providerPrio };
    }).filter(item => {
      return item.agencyId && item.ticketName && item.providerPrio;
    });

    // Reduce providers that have been covered by others
    cheapestComboProviders = _reduceProviders(cheapestComboProviders);
    // If required providers have one or more ticket that can be covered by another,
    // remove all and keep the one that can cover all (basically the more pricy one with lower priority)
    const check = _intersectionWith(requiredProviders, cheapestComboProviders, (a, b) => {
      return a.agencyId === b.agencyId && a.ticketName === b.ticketName && a.providerPrio === b.providerPrio;
    });

    if (check.length === requiredProviders.length) {
      break;
    }
  }

  const cost = _sumBy(cheapestCombo, 'cost');
  return cost;
}

/**
 * Checks whether a given point is inside the polygon
 *
 * @param {object} location - a {lat,lon} pair
 * @param {object} polygon - a GeoJSON polygon
 * @return true if it is inside polygon, false otherwise
 */
function isInside(location, polygon) {
  const point = {
    type: 'Point',
    coordinates: [location.lon, location.lat],
  };
  return geoUtils.pointInPolygon(point, polygon);
}

function _setLegBookingProvider(leg, providers) {
  if (providers.length === 0) {
    return leg;
  }

  if (!leg.agencyId) {
    return leg;
  }

  if (leg.agencyId === providers[0].agencyId && isInside(leg.to, JSON.parse(providers[0].geometry))) {
    leg.agencyData = providers[0];
    return leg;
  }

  // Remove the first provider in the list and check the 2nd one.
  const clone = utils.cloneDeep(providers);
  clone.shift();

  // Self loop the function again if no providers was found
  return _setLegBookingProvider(leg, clone);
}

/**
 * Decide booking providers for all legs of the itineraries
 * @param {Object} itinerary
 * @param {Array} providers - List of providers to decide from.
 */
function _setItineraryBookingProviders(itinerary, providers) {
  // First ascending sort providers by priority
  providers = providers.sort((a, b) => a.value - b.value);
  itinerary.legs = itinerary.legs.map(leg => _setLegBookingProvider(leg, providers));
  return itinerary;
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
  return getTspPricingRules.getOptionsBatch(_values(bookingAgencies), profile)
    .then(providers => {
      providers = _flatten(providers);
      // Filter null responses (e.g. no provider found)
      const filteredProviders = providers.filter(provider => provider !== null);
      itineraries.forEach(itinerary => {
        itinerary = _setItineraryBookingProviders(itinerary, filteredProviders);
        itinerary.fare = {
          points: _calculateItineraryCost(itinerary),
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

      // NOTE since HKL-BICYCLE not available, should this be bookable? Logically it should right?
      if (!leg.agencyId && (['WALK', 'WAIT', 'TRANSFER', 'BICYCLE'].indexOf(leg.mode)) === -1) {
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
