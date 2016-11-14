'use strict';

const rules = require('../get-routes-provider');
const Promise = require('bluebird');
const polylineEncoder = require('polyline-extended');
const utils = require('../../../lib/utils');

const lambdaWrapper = require('../../lambdaWrapper');

const BusinessRuleError = require('../../../lib/errors/BusinessRuleError.js');

// @NOTE support partially train route (go to Leppavaraa on train E)
const HSL_TRAINS  = ['I', 'K', 'N', 'T', 'A', 'E', 'L', 'P', 'U', 'X'];

const DEFAULT_MODES = 'PUBLIC_TRANSIT,TAXI,WALK';


/**
 * Helper predicate function to determine if the given routesProvidersMap is empty.
 * 'Empty' means there are no keys in the map, or that every property of the map is an empty list.
 *
 * @param routesProvidersMap {Object} each property is a list of routes providers, keyed by mode
 */
function _routesProvidersMapEmpty(routesProvidersMap) {
  return (!routesProvidersMap ||
          (Object.keys(routesProvidersMap).length === 0 &&
           Object.keys(routesProvidersMap).every(key => routesProvidersMap[key].length === 0)));
}

/**
 * Get all the distinct priorities of routes providers in the given list.
 * The return list is sorted in priority order (ASC)
 *
 * @param routesProvidersList {Array} a list of routes providers
 * @return {Array} a sorted list of priorities
 */
function _getPrioritiesSorted(routesProvidersList) {
  const ret = [];

  routesProvidersList.map(provider => {
    // Add the each priority if it does not already exist in the list
    if (ret.indexOf(provider.providerPrio) === -1) {
      ret.push(provider.providerPrio);
    }
  });

  // Sort and return the result
  return Object.freeze(ret.sort());
}

/**
 * For each list of providers in the given routesProvidersMap
 * group providers with the same priority in a sub-list.
 * The resulting groups are sorted by priority order (ASC)
 *
 * e.g.
 *
 *  Assuming the routes providers for mode TAXI are such that
 *  pA and pC have a priority of 1, and pB has a priority of 2
 *
 *    { TAXI: [pA, pB, pC] } -> { TAXI: [ [pA, pC], [pB] ] }
 *
 * @param routesProvidersMap {Object} each property is a list of routes providers, keyed by mode
 * @return {Object} a groupedRoutesProvidersMap which is a groupedList of routes providers, keyed by mode
 */
function _groupProvidersByPrioritySorted(routesProvidersMap) {
  const ret = {};

  Object.keys(routesProvidersMap).map(mode => {
    const priorities = _getPrioritiesSorted(routesProvidersMap[mode]);
    const groupedProvidersList = [];

    priorities.map(priority => {
      // Collect all the providers with the current priority into its own sub-list
      groupedProvidersList.push(
          routesProvidersMap[mode].filter(
            provider => (provider.providerPrio === priority)));
    });

    ret[mode] = groupedProvidersList;
  });

  return Object.freeze(ret);
}

/**
 * Function to execute a routes provider with the given params.
 *
 * NOTE: This function is designed to be curried with the params parameter
 * so that it can be then mapped over an array of routes providers.
 *
 * @param params {Object} the routes-query parameters
 * @param provider {Object} the routes provider to execute
 * @return {Object} a promise which resolves to the result of executing the routes provider
 */
const _executeProvider = params => provider => {
  const event = utils.cloneDeep(params);
  return lambdaWrapper.wrap(provider.providerName, event).reflect();
};


/**
 * Execute a list of routes providers one at a time, in order, with the given query params.
 * Note that the input is a groupedProvidersList which is in fact a list of lists.
 * Each sub-list is a list of routes providers which have the same priority.
 * The groupedProvidersList is expected to be in priority order (ASC)
 *
 * @param groupedProvidersList {Array} a list of lists of routes providers, each sub-list is a list of routes providers with the same priority
 * @param params {Object} the routes-query parameters
 * @return {Object} a promise which resolves to the result of the first successful execution
 */
function _executeUntilSuccess(groupedProvidersList, params) {
  // If none of our routes providers return anything, that means the routes just cannot be retrieved
  // THEN we return empty
  if (groupedProvidersList.length === 0) {
    return Promise.resolve([]);
  }

  const head = groupedProvidersList[0];
  const tail = groupedProvidersList.slice(1);

  // Each item in the groupedProvidersList is itself a list of routes providers
  // so we map the _executeProvider function curried with the params over each provider
  return Promise.all(head.map(_executeProvider(params)))
    .then(inspections => {
      // Inspection that succeeded
      const fulfilledInspections = inspections.filter(inspection => inspection.isFulfilled());

      // If no inspection passed, proceed with the rest of the list
      if (fulfilledInspections.length === 0) {
        _executeUntilSuccess(tail, params);
      }

      // If even one of them success, we're happy, return that. NOTE Should we be happy?
      return Promise.resolve(fulfilledInspections.map(inspection => inspection.value()));
    });
}

/**
 * Get a routesProvidersMap to match the modes in the given query params.
 *
 * @param params {Object} contains modes, from, to, leaveAt and arriveBy
 * @return {Object} each property is a list of routes providers, keyed by mode
 */
function _resolveRoutesProviders(params) {
  if (!params.from) {
    throw new BusinessRuleError('Missing "from" input', 500, 'get-routes');
  }
  if (!params.to) {
    throw new BusinessRuleError('Missing "to" input', 500, 'get-routes');
  }

  // 'From' and 'to' coordinates
  const locations = [
    {
      lat: params.from.split(',')[0],
      lon: params.from.split(',')[1],
    },
    {
      lat: params.to.split(',')[0],
      lon: params.to.split(',')[1],
    },
  ];

  // Modes have a default if not specified
  const modes = params.modes || DEFAULT_MODES;

  // Split the modes into a list of strings
  const modesList = modes.split(',');

  // Get the routes providers which can service our modes
  return rules.getRoutesProvidersByModes(modesList)
    .then(routesProvidersMap => {

      // Filter the routes providers by capability to leave only those providers
      // that can handles the given search parameters
      const capableRoutesProvidersMap =
        rules.filterRoutesProviders(
                routesProvidersMap,
                rules.routesProvidersCapabilityFilter(params));

      // Further filter the routes providers by location to leave only those providers
      // that can provide routes for the 'from' and 'to' coordiantes.
      const result =
        rules.filterRoutesProviders(
                capableRoutesProvidersMap,
                rules.routesProvidersLocationFilter(locations));

      // Check that we have at least one routes provider to work with
      if (_routesProvidersMapEmpty(result)) {
        throw new BusinessRuleError(
            'Could not retrieve any routes provider', 500, 'get-routes');
      }

      return Promise.resolve(result);
    });
}

/**
 * Invoke all the routes providers in the given routesProvidersMap with the given params.
 * Each mode is executed separately.
 * For each mode, first group together providers which have the same priority.
 * Then execute each group of providers until at least one provider succeeds.
 * These groups are in priority order (ASC)
 *
 * @param routesProvidersMap {Object} each property is a list of routes providers, keyed by mode
 * @param params {Object} the routes-query parameters
 * @returns {Array} a combined list of all successful routes provider queries
 */
function _invokeProviders(routesProvidersMap, params) {
  if (_routesProvidersMapEmpty(routesProvidersMap)) {
    return [];
  }

  const groupedRoutesProvidersMap = _groupProvidersByPrioritySorted(routesProvidersMap);

  const queries = {};
  Object.keys(groupedRoutesProvidersMap).forEach(mode => (
    queries[mode] = _executeUntilSuccess(groupedRoutesProvidersMap[mode], params)
  ));

  return Promise.props(queries)
    .then(response => {
      const result = [];

      // Merge in all response lists into a single result list
      Object.keys(response).map(mode => (
        Array.prototype.push.apply(result, response[mode])
      ));

      return Object.freeze(result);
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
    if (params.fromName && (!iti.legs[0].from.name || iti.legs[0].from.name === 'Origin')) {
      iti.legs[0].from.name = params.fromName;
    }
    if (params.toName && (!iti.legs[iti.legs.length - 1].to.name || iti.legs[iti.legs.length - 1].to.name === 'Destination')) {
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
