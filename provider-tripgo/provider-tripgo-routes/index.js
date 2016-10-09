'use strict';

const routing = require('./routing');
const validator = require('../../lib/validator');

const responseSchema = require('maas-schemas/prebuilt/maas-backend/provider/routes/response.json');

module.exports.respond = function (event, callback) {
  routing.getCombinedTripGoRoutes(event.from, event.to, event.modes, event.leaveAt, event.arriveBy, event.format)
  .then(response => validator.validate(responseSchema, response))
  .then(response => callback(null, response))
  .catch(err => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });

};
