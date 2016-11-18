'use strict';

const BusinessRuleError = require('../../BusinessRuleError.js');
const getProviderRules = require('../get-provider');
const lambdaWrapper = require('../../lambdaWrapper');
const polylineEncoder = require('polyline-extended');
const Promise = require('bluebird');
const utils = require('../../../lib/utils');
const schema = require('maas-schemas/prebuilt/maas-backend/routes/routes-query/response.json');
const validator = require('../../../lib/validator');

// @NOTE support partially train route (go to Leppavaraa on train E)
const HSL_TRAINS  = ['I', 'K', 'N', 'T', 'A', 'E', 'L', 'P', 'U', 'X'];

/**
 * Return common providers for a leg that provide both from and to locations.
 *
 * @param arriveBy {integer} Input arriveBy
 * @param leaveAt {integer} Input leaveAt
 * @param providersTo {Object}
 * @param providersFrom {Object}
 */
function _filterCommonLegProvider(arriveBy, leaveAt, providersFrom, providersTo) {
  const commonProvider = providersFrom
    // Filter out those that don't have the same agencyId
    .filter(providerFrom => {
      return typeof undefined !== typeof providersTo.find(providerTo => {
        return providerTo.agencyId === providerFrom.agencyId;
      });
    })
    // filter out those that don't support search options
    .filter(provider => {
      if (arriveBy && !provider.hasOwnProperty('capabilities') && provider.capabilities.arriveBy === false) {
        return false;
      } else if (leaveAt && !provider.hasOwnProperty('capabilities') && provider.capabilities.leaveAt === false) {
        return false;
      }
      return true;
    });

  return commonProvider;
}

/**
 * Build a provider query for public transit.
 *
 * @param from {Object} contain lat and lon of 'from' provider
 * @param to {Object} contain lat and lon of 'to' provider
 * @return {Array} array of queries, contains query for provider of 'from' and 'to'
 */
function _buildPtRoutesProvidersQuery(from, to) {

  // Get provider for both from and to location
  return [
    {
      mode: 'PUBLIC_TRANSIT',
      type: 'routes-pt',
      location: { lat: from.lat, lon: from.lon },
    },
    {
      mode: 'PUBLIC_TRANSIT',
      type: 'routes-pt',
      location: { lat: to.lat, lon: to.lon },
    },
  ];
}

/**
 * Build a provider query for taxi.
 *
 * @param from {Object} contain lat and lon of 'from' provider
 * @param to {Object} contain lat and lon of 'to' provider
 * @return {Array} array of queries, contains query for provider of 'from' and 'to'
 */
function _buildTaxiRoutesProvidersQuery(from, to) {
  return [
    {
      mode: 'TAXI',
      type: 'routes-taxi',
      location: { lat: from.lat, lon: from.lon },
    },
    {
      mode: 'TAXI',
      type: 'routes-taxi',
      location: { lat: to.lat, lon: to.lon },
    },
  ];
}

/**
 * Build a provider query for walking legs.
 *
 * @param from {Object} contain lat and lon of 'from' provider
 * @param to {Object} contain lat and lon of 'to' provider
 * @return {Array} array of queries, contains query for provider of 'from' and 'to'
 */
function _buildWalkingRoutesProvidersQuery(from, to) {
  return [
    {
      mode: 'WALK',
      type: 'routes-private',
      location: { lat: from.lat, lon: from.lon },
    },
    {
      mode: 'WALK',
      type: 'routes-private',
      location: { lat: to.lat, lon: to.lon },
    },
  ];
}

/**
 * Build a provider query for public transit.
 *
 * @param from {Object} contain lat and lon of 'from' provider
 * @param to {Object} contain lat and lon of 'to' provider
 * @return {Object} Object queries, with the attribute is the mode to be called
 */
function _buildCyclingRoutesProvidersQuery(from, to) {
  return [
    {
      mode: 'BICYCLE',
      type: 'routes-private',
      location: { lat: from.lat, lon: from.lon },
    },
    {
      mode: 'BICYCLE',
      type: 'routes-private',
      location: { lat: to.lat, lon: to.lon },
    },
  ];
}

/**
 * Combine all routes provider query and run them though getProviderBatch.
 *
 * @param params {Object} contains modes, from, to, leaveAt and arriveBy
 * @return {Object} each property present the list of providers to invoke and the mode to query for
 */
function _resolveRoutesProviders(params) {
  if (!params.from) throw new BusinessRuleError('Missing from input: ' + JSON.stringify(params, null, 2), 500, 'get-routes');
  if (!params.to) throw new BusinessRuleError('Missing to input: ' + JSON.stringify(params, null, 2), 500, 'get-routes');

  const coords = {
    from: {
      lat: params.from.split(',')[0],
      lon: params.from.split(',')[1],
    },
    to: {
      lat: params.to.split(',')[0],
      lon: params.to.split(',')[1],
    },
  };

  let query = {};

  // Decide what to retrieve by reading modes to construct provider queries
  if (params.modes) {
    params.modes.split(',').forEach(mode => {
      switch (mode) {
        case 'PUBLIC_TRANSIT':
          query.ptRoutes = _buildPtRoutesProvidersQuery(coords.from, coords.to);
          break;
        case 'TAXI':
          query.taxiRoutes = _buildTaxiRoutesProvidersQuery(coords.from, coords.to);
          break;
        case 'WALK':
          query.walkingRoutes = _buildWalkingRoutesProvidersQuery(coords.from, coords.to);
          break;
        case 'BICYCLE':
          query.bicycleRoutes = _buildCyclingRoutesProvidersQuery(coords.from, coords.to);
          break;
        default:
          break;
      }
    });
  } else {
    // Don't retrieve Car by default, Taxi will be in presense instead
    query = {
      ptRoutes: _buildPtRoutesProvidersQuery(coords.from, coords.to),
      taxiRoutes: _buildTaxiRoutesProvidersQuery(coords.from, coords.to),
      walkingRoutes: _buildWalkingRoutesProvidersQuery(coords.from, coords.to),
      // bicycleRoutes: _buildCyclingRoutesProvidersQuery(coords.from, coords.to),
    };
  }

  return getProviderRules.getRoutesProvidersBatch(query)
  .then(response => {
    const result = {};
    let ptProviders;
    let taxiProviders;
    let walkingProviders;
    let cyclingProviders;

    if (response.ptRoutes && response.ptRoutes.length > 0) {
      ptProviders = _filterCommonLegProvider(params.arriveBy, params.leaveAt, response.ptRoutes[0], response.ptRoutes[1]);
      if (ptProviders.length > 0) {
        result.PUBLIC_TRANSIT = [];
        result.PUBLIC_TRANSIT = result.PUBLIC_TRANSIT.concat(ptProviders.map(provider => {
          return { provider: provider, modes: 'PUBLIC_TRANSIT' };
        }));
      }
    }
    if (response.taxiRoutes && response.taxiRoutes.length > 0) {
      taxiProviders = _filterCommonLegProvider(params.arriveBy, params.leaveAt, response.taxiRoutes[0], response.taxiRoutes[1]);
      if (taxiProviders.length > 0) {
        result.TAXI = [];
        result.TAXI = result.TAXI.concat(taxiProviders.map(provider => {
          return { provider: provider, modes: 'TAXI' };
        }));
      }
    }
    if (response.walkingRoutes && response.walkingRoutes.length >  0) {
      walkingProviders = _filterCommonLegProvider(params.arriveBy, params.leaveAt, response.walkingRoutes[0], response.walkingRoutes[1]);
      if (walkingProviders.length > 0) {
        result.WALK = [];
        result.WALK = result.WALK.concat(walkingProviders.map(provider => {
          return { provider: provider, modes: 'WALK' };
        }));
      }
    }
    if (response.bicycleRoutes && response.bicycleRoutes.length >  0) {
      cyclingProviders = _filterCommonLegProvider(params.arriveBy, params.leaveAt, response.bicycleRoutes[0], response.bicycleRoutes[1]);
      if (cyclingProviders.length > 0) {
        result.BICYCLE = [];
        result.BICYCLE = result.BICYCLE.concat(cyclingProviders.map(provider => {
          return { provider: provider, modes: 'BICYCLE' };
        }));
      }
    }
    if (Object.keys(result).length === 0 && Object.keys(result).every(key => result[key].length === 0)) {
      return Promise.reject(new BusinessRuleError('Could not retrieve any routes provider', 500, 'get-routes'));
    }

    return Promise.resolve(result);
  });
}

/**
 * Run the lambda call for a batch of providers with the same priority.
 */
function _resolvePromises(input, params, priorityList) {
  // If none of our routes providers return anything, that means the routes just cannot be retrieved
  // THEN we return empty
  if (priorityList.length === 0) {
    return Promise.resolve([]);
  }
  return Promise.all(input.filter(item => item.provider.providerPrio === priorityList[0]).map(item => {
    const event = utils.cloneDeep(params);
    event.modes = item.modes;

    // run the queries, then validate & sanitize them
    return lambdaWrapper.wrap(item.provider.providerName, event)
      .then(result => validator.validate(schema, utils.sanitize(result)))
      .reflect();
  }))
  .then(inspections => {
    // Inspection that succeeded
    const fulfilledInspections = inspections.filter(inspection => inspection.isFulfilled());

    // If no inspection passed, remove the first priority one and use the second one.
    // If an inspection returns an empty route, treat it as a failed request
    if (fulfilledInspections.length === 0) {
      return _resolvePromises(input, params, priorityList.filter(priority => priority !== priorityList[0]));
    }
    // If even one of them success, we're happy, return that. NOTE Should we be happy?
    return Promise.resolve(fulfilledInspections.map(inspection => inspection.value()));
  });
}

/**
 * Logic for invoking providers by priority and fallback for higher priority
 * providers invocation failure.
 *
 * @param input {Object} contains providers data filtered by request mode and the mode to query for
 * @param params {Object} event input for the lambda
 * @return response {Promise - Array} response from provider invocation
 */
function _invokeProviders(input, params) {
  if (input && Object.keys(input).length === 0) return [];
  // Call (multiple) provider with highest priority of each type to get the routes. NOTE: If the highest priority provider for that mode failed
  // fallback to the 1 step lower priority provider
  //
  // E.g: {
  //  taxi: provider1(failed), provider2(failed), provider3(success) -> response
  //  from provider3
  //  walk: provider1(success) -> response from provider1
  //  pt: provider1(failed), provider2(success) -> response from provider2
  //  bicycle: provider1(success) -> response from provider1
  // }

  // Sort grouped providers and cache providerPrio number into a list if it
  // doens not exist
  // Priority list will be used to determine which is the next provider to be
  // called when its higher priority friend failed
  const priorityList = [];
  // eslint-disable-next-line
  for (let key in input) {
    input[key].sort((a, b) => {
      if (priorityList.indexOf(a.provider.providerPrio) === -1) {
        priorityList.push(a.provider.providerPrio);
      } else if (priorityList.indexOf(b.provider.providerPrio) === -1) {
        priorityList.push(b.provider.providerPrio);
      }
      return a.provider.providerPrio - b.provider.providerPrio;
    });
  }

  const queries = {};
  // eslint-disable-next-line
  for (let key in input) {
    queries[key] = new Promise((resolve, reject) => {
      return _resolvePromises(input[key], params, priorityList)
        .then(response => resolve(response))
        .catch(error => reject(error));
    });
  }
  return Promise.props(queries)
    .then(response => {
      let result = [];
      // eslint-disable-next-line
      for (let key in response) {
        result = result.concat(response[key]);
      }
      return result;
    });
}

/**
 * Merge all the responses received from providers invocation.
 *
 * @param responses {Array} input
 * @return {Object} merged output
 */
function _mergeProviderResponses(responses, params) {
  const coords = params.from.split(',').map(parseFloat);
  return utils.sanitize({
    plan: {
      from: {
        lat: coords[0],
        lon: coords[1],
      },
      itineraries: [].concat.apply([], responses.map(r => r.plan.itineraries)),
    },
  });
}

/**
 * If fromName or toName exist, override it onto firstLeg name and lastLeg name field
 * @param {String} fromName - name of the first leg's "to"
 * @param {String} toName - name of the last leg's "from"
 * @return {Object} response - contains the injected data is exist
 */
function _overrideFromToName(response, params) {
  response.plan.itineraries.forEach(iti => {
    if (iti.legs.length === 0) throw new BusinessRuleError('Itinerary has 0 leg ' + iti, 500, 'get-routes');
    if (params.fromName) {
      iti.legs[0].from.name = params.fromName;
    }
    if (params.toName) {
      iti.legs[iti.legs.length - 1].to.name = params.toName;
    }
  });
  return response;
}

/**
 * Set agency for a leg, NOTE this is to adapt leg modes into carrier types.
 *
 * TODO Do not brute force, have a mapping data set on Provider table
 * @param leg {Object}
 * @return agencyId {String} agencyId of the leg
 */
function _setLegAgency(leg) {
  if (leg.mode && leg.agencyId) {
    return leg;
  }

  switch (leg.mode) {
    case 'CAR':
      leg.mode = 'TAXI';
      leg.agencyId = 'Valopilkku';
      break;
    case 'TAXI':
      leg.agencyId = 'Valopilkku';
      break;
    case 'TRAIN':
      // hook to see about VR and others
      if (!leg.agencyId && HSL_TRAINS.some(route => route === leg.route)) {
        leg.agencyId = 'HSL';
      }
      break;
    case 'BUS':
      // NOTE cannot brute force all bus to HSL
      break;
    default:
      leg.agencyId = undefined;
      break;
  }

  return leg;
}

/**
 * Set agency for a leg in an itinerary, NOTE this is to adapt leg modes into
 * carrier types.
 *
 * @param route {Object}
 * @return route {Object}
 */
function _setRouteAgency(route) {
  if (!route.plan.itineraries) {
    throw new BusinessRuleError('Response from route adapter is malformed', 500, 'get-routes');
  }

  if (!route.plan.itineraries.every(itinerary => !itinerary.legs.some(leg => !leg.mode))) {
    throw new Error(`This route contains a leg that does not have mode: ${route}`);
  }

  route.plan.itineraries.map(itinerary => itinerary.legs.map(_setLegAgency));
  return route;
}

function _calculateLegsDistance(route) {
  route.plan.itineraries.forEach(itinerary => {
    itinerary.legs.forEach(leg => {
      if (!leg.distance && leg.legGeometry && leg.legGeometry.points) {
        leg.distance = Math.ceil(polylineEncoder.length(leg.legGeometry.points, 'meter'));
      }
    });
  });

  return route;
}

/**
 * Sort the itienraries by a specification.
 *
 * @param route {Object} route to sort
 * @param sortBy {String} spec to sort according to
 * @return sorted route {Object} if sort routes if provided
 */
function _sortRoute(route, sortBy) {

  if (sortBy === 'distance') {
    route.plan.itineraries = route.plan.itineraries.sort((a, b) => {
      if (a.distance < b.distance) return -1;
      if (a.distance > b.distance) return 1;
      return 0;
    });
  } else if (sortBy === 'duration') {
    route.plan.itineraries = route.plan.itineraries.sort((a, b) => {
      if ((a.endTime - a.startTime) < (b.endTime - b.startTime)) return -1;
      if ((a.endTime - a.startTime) > (b.endTime - b.startTime)) return 1;
      return 0;
    });
  } else if (sortBy === 'endTime') {
    route.plan.itineraries = route.plan.itineraries.sort((a, b) => {
      if (a.endTime < b.endTime) return -1;
      if (a.endTime > b.endTime) return 1;
      return 0;
    });
  }

  return route;
}

/**
 * Get routes using from, to , leaveAt, arriveBy and modes.
 *
 * @param params {Object} contains from, to , leaveAt, arriveBy and modes
 */
function getRoutes(params) {
  return _resolveRoutesProviders(params)
    .then(response => _invokeProviders(response, params))
    .then(responses => _mergeProviderResponses(responses, params))
    .then(response => _overrideFromToName(response, params))
    .then(route => _setRouteAgency(route))
    .then(route => _calculateLegsDistance(route))
    // Sort by endTime by default if no sortBy is input
    .then(route => _sortRoute(route, params.sortBy || 'endTime'));
}

module.exports = {
  getRoutes,
};
