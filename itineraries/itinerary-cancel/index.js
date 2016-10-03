'use strict';

const Promise = require('bluebird');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils');
const Database = models.Database;
const Itinerary = require('../../lib/business-objects/Itinerary');

function validateInput(event) {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId input', 401));
  }

  // TODO Stricter itineraryId validation
  if (!event.hasOwnProperty('itineraryId') || event.itineraryId === '') {
    return Promise.reject(new MaaSError('Missing or invalid itineraryId', 400));
  }

  return Promise.resolve(event);
}

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.removeNulls(itinerary),
    maas: {},
  });
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => validateInput(event))
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
      console.warn(_error.stack);

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
