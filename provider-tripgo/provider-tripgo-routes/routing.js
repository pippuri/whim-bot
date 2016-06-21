'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');

const serviceBus = require('../../lib/service-bus/index');
const _ = require('lodash');

const TRIPGO_PUBLIC_MODES = [
  'pt_pub',

  //'ps_tax',
  //'me_car',
  //'me_car-s_Ekorent',
  //'me_mot',
  //'cy_bic',
  //'wa_wal',
];

const TRIPGO_MIXED_MODES = [
  'pt_pub',
  'ps_tax',
];

const TRIPGO_TAXI_MODES = [
  'ps_tax',
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
    return Promise.reject(new Error('Both leaveAt and arriveBy provided.'));
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
      return Promise.reject(new Error(result.error));
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
    if (_.intersection(region.modes, modes).length !== modes.length) {
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

  const selectedRegion = _.sample(applicableRegions);
  const selectedURL = _.sample(selectedRegion.urls);

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

function getCombinedTripGoRoutes(from, to, leaveAt, arriveBy, format) {
  return serviceBus.call('MaaS-provider-tripgo-regions').then(regionsResponse => {

    const regions = regionsResponse.regions;
    return regions;

  }).then(regions => {

    return Promise.all([
      getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_PUBLIC_MODES),
      getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_MIXED_MODES),
      getTripGoRoutes(regions, from, to, leaveAt, arriveBy, TRIPGO_TAXI_MODES),
    ])
    .then(results => {
      const actualResults = results.filter(r => (r !== null));
      if (actualResults.length < 1) {
        return null;
      }

      const response = mergeResults(actualResults);

      if (format === 'original') {
        return response;
      }

      return adapter(response);
    });

  });
}

module.exports.getCombinedTripGoRoutes = getCombinedTripGoRoutes;
