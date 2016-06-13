'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');

const DIGITRANSIT_HSL_URL = 'http://api.digitransit.fi/routing/v1/routers/hsl/plan';

function getOTPDate(timestamp) {
  const time = new Date(timestamp);
  const zeros = '0000';
  const yyyy = ( zeros + time.getUTCFullYear()    ).slice(0 - 'YYYY'.length);
  const mm =   ( zeros + (time.getUTCMonth() + 1) ).slice(0 - 'MM'.length);
  const dd =   ( zeros + time.getUTCDate()        ).slice(0 - 'DD'.length);
  return [yyyy, mm, dd].join('-');
}

function getOTPTime(timestamp) {
  const time = new Date(timestamp);
  const zeros = '00';
  const hh =   ( zeros + time.getUTCHours()       ).slice(0 - 'HH'.length);
  const mm =   ( zeros + time.getUTCMinutes()     ).slice(0 - 'mm'.length);
  const ss =   ( zeros + time.getUTCSeconds()     ).slice(0 - 'ss'.length);
  return [hh, mm, ss].join(':');
}

// Docs: http://dev.opentripplanner.org/apidoc/0.15.0/resource_PlannerResource.html

function getDigitransitRoutes(from, to, leaveAt, arriveBy, format) {

  const qs = {
    fromPlace: from,
    toPlace: to,
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
    // Current routes. No need to add any parameters.
  }

  return request.get(DIGITRANSIT_HSL_URL, {
    json: true,
    qs: qs,
  })
  .then(function (result) {
    if (format === 'original') {
      return result;
    }

    return adapter(result);
  });
}

module.exports.respond = function (event, callback) {
  getDigitransitRoutes(event.from, event.to, event.leaveAt, event.arriveBy, event.format)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
