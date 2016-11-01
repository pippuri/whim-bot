'use strict';

/**
 * Digitransit routes provider - provides Finnish public transport &
 * long-distance trains & buses.
 *
 * @see http://dev.opentripplanner.org/apidoc/0.15.0/resource_PlannerResource.html
 * @see https://digitransit.fi/en/developers/services-and-apis/1-routing-api/itinerary-planning/
 */

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');
const MaaSError = require('../../lib/errors/MaaSError');
const lib = require('./lib');

const DIGITRANSIT_FINLAND_API_URL = 'https://api.digitransit.fi/routing/v1/routers/finland/index/graphql';

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
    return Promise.reject(new MaaSError('Both leaveAt and arriveBy provided.', 400));
  } else if (leaveAt) {
    qs.arriveBy = false;
    const date = new Date(parseInt(leaveAt, 10));
    qs.date = lib.getOTPDate(date);
    qs.time = lib.getOTPTime(date);
  } else if (arriveBy) {
    const date = new Date(parseInt(arriveBy, 10));
    qs.arriveBy = true;
    qs.date = lib.getOTPDate(date);
    qs.time = lib.getOTPTime(date);
  } else {
    qs.arriveBy = false;
    qs.date = lib.getOTPDate(new Date());
    qs.time = lib.getOTPTime(new Date());
  }

  if (modes) {
    qs.modes = lib.convertDigitransitModes(modes);
  }

  const constructedGraphQL = `{
    plan(
      from: {lat: ${qs.coords.from.lat}, lon: ${qs.coords.from.lon}},
      to: {lat: ${qs.coords.to.lat}, lon: ${qs.coords.to.lon}},
      modes: "${lib.convertDigitransitModes(modes)}",
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
  .then(response => callback(null, response))
  .catch(_error => {
    console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    // Uncaught, unexpected error
    if (_error instanceof MaaSError) {
      callback(_error);
      return;
    }

    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  });
};
