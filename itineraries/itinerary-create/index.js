'use strict';

const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const Database = models.Database;
const Trip = require('../../lib/trip');
const Itinerary = require('../../lib/business-objects/Itinerary');

module.exports.respond = function (event, callback) {

  return Database.init()
    .then(() => utils.validateSignatures(event.itinerary))        // Validate request signature
    .then(validItineraryData => Itinerary.create(validItineraryData, event.identityId))
    .then(itinerary => {
      Database.cleanup()
        .then(() => callback(null, itinerary));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });

};
