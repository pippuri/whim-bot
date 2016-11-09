'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');
const MaaSError = require('../../../lib/errors/MaaSError');

const serviceBus = require('../../../lib/service-bus/index');
const _intersection = require('lodash/intersection');
const _sample = require('lodash/sample');

const TRIPGO_PUBLIC_MODES = [
  'pt_pub',
  'wa_wal',
];

const TRIPGO_MIXED_MODES = [
  'pt_pub',
  'ps_tax',
  'ps_tnc',
  'wa_wal',
];

const TRIPGO_TAXI_MODES = [
  'ps_tax',
];

const TRIPGO_WALK_MODES = [
  'wa_wal',
];

const TRIPGO_CAR_MODES = [
  'me_car',
];

function isInsideRegion(coords, area) {
  const parts = coords.split(',');
  const lat = parts[0];
  const lon = parts[1];
  return (area[0] <= lat && lat <= area[2] &&
    area[1] <= lon && lon <= area[3]);
}

// Docs: http://planck.buzzhives.com/swagger/index.html#!/Routing/get_routing_json

function getTripGoRoutesByUrl(baseUrl, from, to, leaveAt, arriveBy, modes) {
  const qs = {
    v: '11',
    from: '(' + from + ')',
    to: '(' + to + ')',
    avoid: '', // public transport modes to avoid, separated by commas
    tt: '3', // preferred transfer time in minutes
    ws: '1', // walking speed (0=slow 1=medium 2=fast)
    cs: '1', // cycling speed (0=slow 1=medium 2=fast)
    wp: '(1, 1, 1, 1)', // weights for price, environmental impact, duration, and convenience between 0.1..2.0
    ir: 'true', // interregional results
    modes: modes, // modes to use in routing, as an array
  };
  if (leaveAt && arriveBy) {
    return Promise.reject(new MaaSError('Both leaveAt and arriveBy provided.', 400));
  } else if (leaveAt) {
    qs.departAfter = Math.floor(parseInt(leaveAt, 10) / 1000);
  } else if (arriveBy) {
    qs.arriveBefore = Math.floor(parseInt(arriveBy, 10) / 1000);
  } else {
    qs.departAfter = Math.floor(Date.now() / 1000);
  }

  return request.get(baseUrl, {
    json: true,
    headers: {
      'X-TripGo-Key': process.env.TRIPGO_API_KEY,
    },
    qs: qs,
    useQuerystring: true,
  })
  .then(result => {
    if (result.error) {
      return Promise.reject(new MaaSError(result.error, 500));
    }

    return result;
  })
  .catch(e => {
    if (e.message === 'Destination lies outside covered area.') {
      return null;
    }

    throw e;
  });
}

function getTripGoRoutes(regions, from, to, leaveAt, arriveBy, modes) {

  const applicableRegions = regions.filter(region => {
    const area = region.area;
    if (_intersection(region.modes, modes).length !== modes.length) {
      return false;
    }

    if (!isInsideRegion(from, area)) {
      return false;
    }

    return true;
  });

  if (applicableRegions.length < 1) {
    return null;
  }

  const selectedRegion = _sample(applicableRegions);
  const selectedURL = _sample(selectedRegion.urls);

  const routingURL = selectedURL + '/routing.json';
  return getTripGoRoutesByUrl(routingURL, from, to, leaveAt, arriveBy, modes);
}

function mergeResults(results) {
  let response;
  results.forEach( result => {
    if (typeof response === typeof undefined) {
      response = result;
    } else {
      if (result && result.groups) {
        result.groups.map(group => {
          response.groups.push(group);
        });
      }

      if (result && result.segmentTemplates) {
        result.segmentTemplates.map(segmentTemplate => {
          response.segmentTemplates.push(segmentTemplate);
        });
      }

    }

  });

  return response;
}

function getCombinedTripGoRoutes(from, to, modes, leaveAt, arriveBy, format) {
  return serviceBus.call('MaaS-provider-tripgo-regions').then(regionsResponse => {

    const regions = regionsResponse.regions;
    return regions;

  }).then(regions => {

    const queue = [];

    if (!modes || modes.split(',').length === 0) {
      queue.push(getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_PUBLIC_MODES));
      queue.push(getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_MIXED_MODES));
      queue.push(getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_TAXI_MODES));
    } else if (modes.split(',').length > 1) {
      throw new MaaSError('Support either no input mode or only 1 input mode', 400);
    } else {
      modes.split(',').forEach(mode => {
        switch (mode) {
          case 'PUBLIC_TRANSIT':
            queue.push(getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_PUBLIC_MODES));
            break;
          case 'CAR':
            queue.push(getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_CAR_MODES));
            break;
          case 'TAXI':
            queue.push(getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_TAXI_MODES));
            break;
          case 'WALK':
            queue.push(getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_WALK_MODES));
            break;
          case 'BICYCLE':
            throw new MaaSError('Tripgo does not support BICYCLE route', 500);
          default:
            break;
        }
      });
    }

    return Promise.all(queue)
      .then(results => {
        const coords = from.split(',').map(parseFloat);
        const formattedFrom = {
          lat: coords[0],
          lon: coords[1],
        };
        const actualResults = results.filter(r => (r !== null));
        if (actualResults.length < 1) {
          return adapter([], formattedFrom);
        }

        const response = mergeResults(actualResults);

        return adapter(response, formattedFrom);
      })
      .then(response => {
        // Filter the itineraries of the plan by leaveAt and arriveBy
        const filteredPlan = Object.assign({}, response.plan);
        filteredPlan.itineraries = response.plan.itineraries.filter(i => {
          if (leaveAt && i.startTime < leaveAt) {
            return false;
          }

          if (arriveBy && i.endTime > arriveBy) {
            return false;
          }

          return true;
        });

        return { plan: filteredPlan };
      });
  });
}

module.exports.getCombinedTripGoRoutes = getCombinedTripGoRoutes;
