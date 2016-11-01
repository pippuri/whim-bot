'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils');
const models = require('../../lib/models');
const Database = models.Database;
const Itinerary = require('../../lib/business-objects/Itinerary');

/**
 * Validates the input event to have identityId and itineraryId
 * (passed as query string).
 *
 * @param {object} event the input event, as received from API Gateway
 */
function validateInput(event) {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId input', 400));
  }

  if (event.itineraryId !== '' && !event.itineraryId.match(/[A-F0-9]{8}(-[A-F0-9]{4}){3}-[A-F0-9]{12}/i)) {
    return Promise.reject(new MaaSError('Invalid itineraryId format', 400));
  }

  return Promise.resolve(event);
}

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.sanitize(itinerary),
    maas: {},
  });
}

module.exports.respond = (event, callback) => {

  return Database.init()
    .then(() => validateInput(event))
    .then(() => Itinerary.retrieve(event.itineraryId))
    .then(itinerary => itinerary.validateOwnership(event.identityId))
    .then(itinerary => formatResponse(itinerary.toObject()))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
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
