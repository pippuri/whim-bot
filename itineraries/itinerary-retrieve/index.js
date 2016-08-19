'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils');
const models = require('../../lib/models');
const Database = models.Database;

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

function fetchItinerary(identityId, itineraryId) {
  // Get the old state
  return models.Itinerary.query()
    .findById(itineraryId)
    .eager('[legs, legs.booking]')
    .then(itinerary => {
      // Handle not found
      if (typeof itinerary === typeof undefined) {
        return Promise.reject(new MaaSError(`No item found with itineraryId ${itineraryId}`, 404));
      }

      // Handle item not user's itinerary
      if (itinerary.identityId !== identityId) {
        return Promise.reject(new MaaSError(`Itinerary ${itineraryId} not owned by the user`, 403));
      }

      return Promise.resolve(itinerary);
    });
}

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.removeNulls(itinerary),
    maas: {},
  });
}

module.exports.respond = (event, callback) => {

  return Promise.all([
    Database.init(),
    validateInput(event),
  ])
    .then(() => fetchItinerary(event.identityId, event.itineraryId))
    .then(itinerary => formatResponse(itinerary))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
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
