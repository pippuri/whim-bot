'use strict';

const Promise = require('bluebird');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils');
const Database = models.Database;
const Trip = require('../../lib/trip');
const Itinerary = require('../../lib/business-objects/Itinerary');

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.removeNulls(itinerary),
    maas: {},
  });
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => Itinerary.retrieve(event.itineraryId))
    .then(itinerary => itinerary.validateOwnership(event.identityId))
    .then(itinerary => itinerary.cancel())
    .then(itinerary => formatResponse(itinerary.toObject()))
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
