'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');

const DIGITRANSIT_HSL_URL = 'http://api.digitransit.fi/routing/v1/routers/hsl/plan';

function getOTPDate(timestamp) {
  const time = new Date(timestamp);
  const zeros = '0000';
  // SPi note: making this timezone naive, assuming timestamp is already in local time
  const yyyy = ( zeros + time.getFullYear()    ).slice(0 - 'YYYY'.length);
  const mm =   ( zeros + (time.getMonth() + 1) ).slice(0 - 'MM'.length);
  const dd =   ( zeros + time.getDate()        ).slice(0 - 'DD'.length);
  return [yyyy, mm, dd].join('-');
}

function getOTPTime(timestamp) {
  const time = new Date(timestamp);
  const zeros = '00';
  const hh =   ( zeros + time.getHours()       ).slice(0 - 'HH'.length);
  const mm =   ( zeros + time.getMinutes()     ).slice(0 - 'mm'.length);
  const ss =   ( zeros + time.getSeconds()     ).slice(0 - 'ss'.length);
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
  .then(result => adapter(result));
}

module.exports.respond = function (event, callback) {
  getDigitransitRoutes(event.from, event.to, event.leaveAt, event.arriveBy, event.format)
  .then(response => {
    callback(null, response);
  })
  .catch(_error => {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    callback(_error);
  });
};
