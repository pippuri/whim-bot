'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');

const responseSchema = require('maas-schemas/prebuilt/maas-backend/provider/routes/response.json');

// const DIGITRANSIT_FINLAND_API_URL = 'http://api.digitransit.fi/routing/v1/routers/finland/plan';
const DIGITRANSIT_FINLAND_API_URL = 'https://api.digitransit.fi/routing/v1/routers/finland/index/graphql';
const UTC_SUMMER_OFFSET = 2 * 60 * 60 * 1000;
const UTC_WINTER_OFFSET = 3 * 60 * 60 * 1000;

function getUTCOffset(date) {
  // Determine the UTC offset from daylight saving time 31st March, 31st Oct
  // clocks are turned at 3AM (UTC 0AM) to winter time and 4AM (UTC 2AM) to
  // summer time. Note that month indexes are 0-based, days are 1-based
  if (date.getUTCMonth() > 2 && date.getUTCMonth() < 10) {
    // Exception case: April 1st: Clocks turned to summer time at 2AM UTC
    if (date.getUTCMonth() === 3 && date.getUTCDate() === 1 && date.getUTCHours() < 2) {
      return UTC_WINTER_OFFSET;
    }

    // Summer time
    return UTC_SUMMER_OFFSET;
  }

  // Winter time
  return UTC_WINTER_OFFSET;
}

function getOTPDate(date) {
  // Compute a date that is localised to Finland
  const d = new Date(date.valueOf() + getUTCOffset(date));
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function getOTPTime(date) {
  // Compute a date that is localised to Finland
  const d = new Date(date.valueOf() + getUTCOffset(date));
  return `${d.getUTCHours()}:${d.getUTCMinutes()}:${d.getUTCSeconds()}`;
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
    const date = new Date(parseInt(leaveAt, 10));
    qs.date = getOTPDate(date);
    qs.time = getOTPTime(date);
  } else if (arriveBy) {
    const date = new Date(parseInt(arriveBy, 10));
    qs.arriveBy = true;
    qs.date = getOTPDate(date);
    qs.time = getOTPTime(date);
  } else {
    qs.arriveBy = false;
    qs.date = getOTPDate(new Date());
    qs.time = getOTPTime(new Date());
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
