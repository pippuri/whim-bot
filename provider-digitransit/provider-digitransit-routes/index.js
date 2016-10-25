'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const moment = require('moment-timezone');

const responseSchema = require('maas-schemas/prebuilt/maas-backend/provider/routes/response.json');

// const DIGITRANSIT_FINLAND_API_URL = 'http://api.digitransit.fi/routing/v1/routers/finland/plan';
const DIGITRANSIT_FINLAND_API_URL = 'https://api.digitransit.fi/routing/v1/routers/finland/index/graphql';

function getOTPDate(timestamp) {
  const time = moment.tz(timestamp, 'Europe/Helsinki'); // format: 2016-10-16T18:57:06+03:00
  return time.format().split(/T|\+/)[0];
}

function getOTPTime(timestamp) {
  const time = moment.tz(timestamp, 'Europe/Helsinki'); // format: 2016-10-16T18:57:06+03:00
  return time.format().split(/T|\+/)[1];
}

function convertDigitransitModes(eventModes) {
  if (!eventModes) return 'BUS,TRAM,RAIL,SUBWAY,FERRY,WALK,BICYCLE';
  return eventModes.split(',').map(mode => {
    switch (mode) {
      case 'PUBLIC_TRANSIT':
        return 'BUS,TRAM,RAIL,SUBWAY,FERRY,WALK';
      case 'TAXI':
        return 'CAR';
      case 'CAR':
      case 'WALK':
      case 'BICYCLE':
      default:
        return mode;
    }
  }).join(',');
}

// Docs: http://dev.opentripplanner.org/apidoc/0.15.0/resource_PlannerResource.html
// @see https://digitransit.fi/en/developers/services-and-apis/1-routing-api/itinerary-planning/

function getDigitransitRoutes(from, to, modes, leaveAt, arriveBy, format) {

  const qs = {
    coords: {
      from: {
        lat: parseFloat(from.split(',')[0]),
        lon: parseFloat(from.split(',')[1]),
      },
      to: {
        lat: parseFloat(to.split(',')[0]),
        lon: parseFloat(to.split(',')[1]),
      },
    },
  };

  if (leaveAt && arriveBy) {
    return Promise.reject(new Error('Both leaveAt and arriveBy provided.'));
  } else if (leaveAt) {
    qs.arriveBy = false;
    qs.date = getOTPDate(parseInt(leaveAt, 10));
    qs.time = getOTPTime(parseInt(leaveAt, 10));
  } else if (arriveBy) {
    qs.arriveBy = true;
    qs.date = getOTPDate(parseInt(arriveBy, 10));
    qs.time = getOTPTime(parseInt(arriveBy, 10));
  } else {
    qs.arriveBy = false;
    qs.date = getOTPDate(Date.now(), 10);
    qs.time = getOTPDate(Date.now(), 10);
  }

  if (modes) {
    qs.modes = convertDigitransitModes(modes);
  }

  const constructedGraphQL = `{
    plan(
      from: {lat: ${qs.coords.from.lat}, lon: ${qs.coords.from.lon}},
      to: {lat: ${qs.coords.to.lat}, lon: ${qs.coords.to.lon}},
      modes: "${convertDigitransitModes(modes)}",
      walkSpeed: 1.39,
      date: "${qs.date}"
      time: "${qs.time}"
      optimize: SAFE
      numItineraries: 20
    ) {
      itineraries{
        startTime
        endTime
        legs {
          mode
          startTime
          endTime
          route {
            shortName
            longName
          }
          distance
          from {
            lat
            lon
            name
            stop {
              code
              name
            }
          },
          to {
            lat
            lon
            name
            stop {
              code
              name
            }
          },
          agency {
            name
          }
          legGeometry {
            points
          }
        }
      }
    }
  }
  `;

  // Digitransit GraphQL require method to be POST
  return request.post(DIGITRANSIT_FINLAND_API_URL, {
    headers: {
      'Content-Type': 'application/graphql',
    },
    body: constructedGraphQL,
  })
  .then(buffer => adapter(qs.coords.from, JSON.parse(buffer.toString())));
}

module.exports.respond = function (event, callback) {

  if (event.modes && event.modes.split(',').length > 1) {
    return Promise.reject(new MaaSError('Currently support either no input mode or a single one', 400));
  }

  return getDigitransitRoutes(event.from, event.to, event.modes, event.leaveAt, event.arriveBy, event.format)
  .then(response => validator.validate(responseSchema, response))
  .then(response => callback(null, response))
  .catch(_error => {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    callback(_error);
  });
};
