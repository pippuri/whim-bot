var Promise = require('bluebird');
var request = require('request-promise');
var adapter = require('./adapter');

var DIGITRANSIT_HSL_URL = 'http://beta.digitransit.fi/otp/routers/hsl/plan';

function getOTPDate(timestamp) {
  var time = new Date(timestamp);
  var zeros = '0000';
  var yyyy = ( zeros + time.getUTCFullYear()    ).slice(0 - 'YYYY'.length);
  var mm =   ( zeros + (time.getUTCMonth() + 1) ).slice(0 - 'MM'.length);
  var dd =   ( zeros + time.getUTCDate()        ).slice(0 - 'DD'.length);
  return [yyyy, mm, dd].join('-');
}

function getOTPTime(timestamp) {
  var time = new Date(timestamp);
  var zeros = '00';
  var hh =   ( zeros + time.getUTCHours()       ).slice(0 - 'HH'.length);
  var mm =   ( zeros + time.getUTCMinutes()     ).slice(0 - 'mm'.length);
  var ss =   ( zeros + time.getUTCSeconds()     ).slice(0 - 'ss'.length);
  return [hh, mm, ss].join(':');
}

// Docs: http://dev.opentripplanner.org/apidoc/0.15.0/resource_PlannerResource.html

function getDigitransitRoutes(from, to, leaveAt, arriveBy, format) {

  var qs = {
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
    } else {
      return adapter(result);
    }
  });
}

module.exports.respond = function (event, callback) {
  getDigitransitRoutes(event.from, event.to, event.leaveAt, event.arriveBy, event.format)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
