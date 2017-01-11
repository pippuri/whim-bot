'use strict';

const routesProviderRules = require('../get-routes-provider');
const Promise = require('bluebird');
const polylineEncoder = require('polyline-extended');
const utils = require('../../../lib/utils');
const schema = require('maas-schemas/prebuilt/maas-backend/routes/routes-query/response.json');
const validator = require('../../../lib/validator');

const lambdaWrapper = require('../../lambdaWrapper');

const BusinessRuleError = require('../../../lib/errors/BusinessRuleError.js');

// @NOTE support partially train route (go to Leppavaraa on train E)
const HSL_TRAINS  = ['I', 'K', 'N', 'T', 'A', 'E', 'L', 'P', 'U', 'X'];

const DEFAULT_MODES = 'PUBLIC_TRANSIT,TAXI,WALK';
const PROVIDER_REQUEST_TIMEOUT_MS = 5000;

/*
 * In the following code the following terms are used:
 *  - routes provider: an object which is retrieved from the RoutesProvider database table
 *
 *  - mode: A string, e.g. 'TAXI', 'WALK'
 *
 *  - routesProviderList: an array of routes providers
 *
 *  - routesProviderMap: an object which maps modes to routesProviderLists:
 *    e.g.
 *      {
 *        'TAXI': [ rpA, rpB, rpC ],
 *        'WALK': [ rpD ]
 *      }
 *
 *  - groupedRoutesProviderList: an array of arrays, each sub-array is a
 *    list of routes providers with the same priority:
 *    e.g.
 *      [ [ rpA, rpC, rpD ], [ rpB ] ]
 *
 *  - groupedRoutesProvidersMap: an object which maps modes to groupedRoutesProviderLists
 *    e.g.
 *      {
 *        'TAXI': [ [ rpA, rpC ], [ rpB ] ],
 *        'WALK': [ [ rpC ] ]
 *      }
 */


/**
 * Helper predicate function to determine if the given routesProvidersMap is empty.
 * 'Empty' means there are no keys in the map, or that every property of the map is an empty list.
 *
 * @param {Object} routesProvidersMap - each property is a list of routes providers, keyed by mode
 * @return {Boolean}
 */
function _routesProvidersMapEmpty(routesProvidersMap) {
  return (!routesProvidersMap ||
          Object.keys(routesProvidersMap).length === 0 ||
          Object.keys(routesProvidersMap).every(key => routesProvidersMap[key].length === 0));
}

/**
 * Get all the distinct priorities of routes providers in the given list.
 * The return list is sorted in priority order (ASC)
 *
 * @param {Array} routesProvidersList - a list of routes providers
 * @return {Array} - a sorted list of priorities
 */
function _getPrioritiesSorted(routesProvidersList) {
  const ret = [];

  routesProvidersList.forEach(provider => {
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
 * @param {Object} routesProvidersMap - each property is a list of routes providers, keyed by mode
 * @return {Object} - a groupedRoutesProvidersMap which is a groupedList of routes providers, keyed by mode
 */
function _groupProvidersByPrioritySorted(routesProvidersMap) {
  const ret = {};

  Object.keys(routesProvidersMap).forEach(mode => {
    const priorities = _getPrioritiesSorted(routesProvidersMap[mode]);
    const groupedProvidersList = [];

    priorities.forEach(priority => {
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
 * NOTE: This function is designed to be curried with the (mode, params) arguments
 * so that it can be then mapped over an array of routes providers.
 *
 * @param {String} mode - the mode for this provider request
 * @param {Object} params - the routes-query parameters
 * @param {Object} provider - the routes provider to execute
 * @return {Object} - a promise which resolves to the result of executing the routes provider
 */
const _executeProvider = (mode, params) => provider => {
  const event = utils.cloneDeep(params);
  event.modes = mode;

  // run the queries, then validate & sanitize them
  return lambdaWrapper.wrap(provider.providerName, event)
    .timeout(PROVIDER_REQUEST_TIMEOUT_MS, `Provider ${provider.providerName} timed out after ${PROVIDER_REQUEST_TIMEOUT_MS}ms`)
    .then(result => validator.validate(schema, utils.sanitize(result)))
    .then(result => {
      // Treat empty itineraries list as a faulty response
      if (result.plan && result.plan.itineraries.length === 0) {
        console.warn(`${provider.providerName} return empty response for ${mode}`);
        return Promise.reject(new Error(`Request to ${provider.providerName} returns empty itineraries list`));
      }

      return result;
    })
    .reflect();
};


/**
 * Execute a list of routes providers one at a time, in order, with the given query params.
 * Note that the input is a groupedProvidersList which is in fact a list of lists.
 * Each sub-list is a list of routes providers which have the same priority.
 * The groupedProvidersList is expected to be in priority order (ASC)
 *
 * @param {Array} groupedProvidersList - a list of lists of routes providers, each sub-list is a list of routes providers with the same priority
 * @param {String} mode - the mode for this provider request
 * @param {Object} params - the routes-query parameters
 * @return {Object} - a promise which resolves to the result of the first successful execution
 */
function _executeUntilSuccess(groupedProvidersList, mode, params) {
  // If none of our routes providers return anything, that means the routes just cannot be retrieved
  // THEN we return empty
  if (groupedProvidersList.length === 0) {
    return Promise.resolve([]);
  }

  const head = groupedProvidersList[0];
  const tail = groupedProvidersList.slice(1);

  // Each item in the groupedProvidersList is itself a list of routes providers
  // so we map the _executeProvider function curried with (mode, params) over each provider
  return Promise.all(head.map(_executeProvider(mode, params)))
    .then(inspections => {
      // Inspection that succeeded
      const fulfilledInspections = inspections.filter(inspection => inspection.isFulfilled());
      const rejectedInspections = inspections.filter(inspection => inspection.isRejected());
      if (rejectedInspections.length > 0) {
        rejectedInspections.forEach(inspection => {
          console.warn('Provider failure: ', inspection.reason());
        });
      }

      // If no inspection passed, proceed with the rest of the list
      if (fulfilledInspections.length === 0) {
        console.info(`\t\tFalling back (${mode})`);
        head.forEach(provider => {
          console.info(`\t\t\t${provider.providerName}`);
        });

        return _executeUntilSuccess(tail, mode, params);
      }

      // If even one of them success, we're happy, return that. NOTE Should we be happy?
      return Promise.resolve(fulfilledInspections.map(inspection => inspection.value()));
    });
}

/**
 * Get a routesProvidersMap to match the modes in the given query params.
 *
 * @param {Object} params - contains modes, from, to, leaveAt and arriveBy
 * @return {Object} - each property is a list of routes providers, keyed by mode
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
  return routesProviderRules.getRoutesProvidersByModesList(modesList)
    .then(routesProvidersMap => {

      // Filter the routes providers by capability to leave only those providers
      // that can handles the given search parameters
      const capableRoutesProvidersMap =
        routesProviderRules.filterRoutesProviders(
                routesProvidersMap,
                routesProviderRules.routesProvidersCapabilityFilter(params));

      // Further filter the routes providers by location to leave only those providers
      // that can provide routes for the 'from' and 'to' coordiantes.
      const result =
        routesProviderRules.filterRoutesProviders(
                capableRoutesProvidersMap,
                routesProviderRules.routesProvidersLocationFilter(locations));

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
 * @param {Object} routesProvidersMap - each property is a list of routes providers, keyed by mode
 * @param {Object} params - the routes-query parameters
 * @returns {Array} - a combined list of all successful routes provider queries
 */
function _invokeProviders(routesProvidersMap, params) {
  if (_routesProvidersMapEmpty(routesProvidersMap)) {
    return [];
  }

  const groupedRoutesProvidersMap = _groupProvidersByPrioritySorted(routesProvidersMap);

  const queries = {};
  Object.keys(groupedRoutesProvidersMap).forEach(mode => (
    queries[mode] = _executeUntilSuccess(groupedRoutesProvidersMap[mode], mode, params)
  ));

  return Promise.props(queries)
    .then(response => {
      const result = [];

      // Merge in all response lists into a single result list
      Object.keys(response).forEach(mode => (
        Array.prototype.push.apply(result, response[mode])
      ));

      return Object.freeze(result);
    });
}


/**
 * Merge all the responses received from providers invocation.
 *
 * @param {Array} responses - input
 * @param {Object} params - original query params
 * @return {Object} - merged output
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
 * Set agency for a leg if it is missing
 *
 * NOTE: this is to adapt leg modes into carrier types.
 * NOTE: this function is designed to be curried on routesProvider
 *       so that the result can be used to map over a list of legs.
 *
 * [TODO: Do not brute force, have a mapping data set on Provider table]
 *
 * @param {Object} routesProvider - the routes provider which was the source of this leg
 * @param {Object} leg - the leg to amend
 * @return {Object} - the leg, amended if necessary
 */
const _setLegAgency = routesProvider => leg => {
  if (leg.mode && leg.agencyId) {
    return leg;
  }

  switch (leg.mode) {
    case 'CAR':
    case 'TAXI':
      leg.mode = 'TAXI';
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
};

/**
 * Set agency for each leg in each itinerary in a route
 *
 * NOTE: this is to adapt leg modes into carrier types
 *
 * @param {Object} route - the route to amend
 * @return {Object} - the route, amended as necessary
 */
function _setRouteAgency(route) {
  if (!route.plan.itineraries) {
    throw new BusinessRuleError('Response from route adapter is malformed', 500, 'get-routes');
  }

  if (!route.plan.itineraries.every(itinerary => !itinerary.legs.some(leg => !leg.mode))) {
    throw new Error(`This route contains a leg that does not have mode: ${route}`);
  }
  route.plan.itineraries.forEach(
    itinerary => itinerary.legs.forEach(
      _setLegAgency(itinerary.__routesProvider)));

  return route;
}

/**
 * Calculate the geographic distance for each leg in each itinerary in the given route
 *
 * @param {Object} route - the route to amend
 * @return {Object} - the route, amended as necessary
 */
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
 * Sort the itienraries by a specification
 *
 * NOTE: Sort by endTime by default if no sortBy is input
 *
 * @param {Object} route - route to sort
 * @param {String} sortBy - spec to sort according to
 * @return {Object} - sorted route if sort routes if provided
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
 * Get routes using from, to , leaveAt, arriveBy and modes
 *
 * @param {Object} params - contains from, to , leaveAt, arriveBy and modes
 * @return {Promise} - a promise which resolves to the result route
 */
function getRoutes(params) {
  return _resolveRoutesProviders(params)
    .then(response => _invokeProviders(response, params))
    .then(responses => _mergeProviderResponses(responses, params))
    .then(response => _overrideFromToName(response, params))
    .then(route => _setRouteAgency(route))
    .then(route => _calculateLegsDistance(route))
    .then(route => _sortRoute(route, params.sortBy || 'endTime'));
}

module.exports = {
  getRoutes,
};
