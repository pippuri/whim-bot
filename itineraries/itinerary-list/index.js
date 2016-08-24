'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils');
const models = require('../../lib/models');
const stateMachine = require('../../lib/states/index').StateMachine;
const Database = models.Database;

/**
 * Validates the input event to have identityId and itineraryId
 * (passed as query string).
 *
 * @param {object} event the input event, as received from API Gateway
 */
function parseAndValidateInput(event) {
  const identityId = event.identityId;
  const startTime = (utils.isEmptyValue(event.startTime)) ? null : parseInt(event.startTime, 10);
  const endTime = (utils.isEmptyValue(event.endTime)) ? null : parseInt(event.endTime, 10);
  const states = (utils.isEmptyValue(event.states)) ? [] : event.states.split(',');
  const validStates = stateMachine.getAllStates('Itinerary');

  if (typeof identityId === 'undefined' || identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId input', 401));
  }

  if (startTime !== null && startTime <= 0) {
    const message = `Invalid startTime: ${event.startTime}; expecting positive integer`;
    return Promise.reject(new MaaSError(message, 400));
  }

  if (endTime !== null && endTime <= 0) {
    const message = `Invalid startTime: ${event.endTime}; expecting positive integer`;
    return Promise.reject(new MaaSError(message, 400));
  }

  if (endTime && startTime && endTime < startTime) {
    const message = `Invalid endTime: ${event.endTime}; must be greater than equal to startTime ${event.startTime}`;
    return Promise.reject(new MaaSError(message, 400));
  }

  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    if (!validStates.some(s => s === state)) {
      const message = `Invalid state ${state} in states, should be one of ${validStates}`;
      return Promise.reject(new MaaSError(message, 400));
    }
  }

  return Promise.resolve({
    identityId: identityId,
    startTime: startTime,
    endTime: endTime,
    states: states,
  });
}

function fetchItineraries(identityId, startTime, endTime, states) {
  let query = models.Itinerary.query()
    .where('identityId', identityId);

  if (startTime !== null) {
    query = query.andWhere('startTime', '>=', (new Date(startTime)).toISOString());
  }

  if (endTime !== null) {
    query = query.andWhere('endTime', '<=', (new Date(endTime)).toISOString());
  }

  if (states.length > 0) {
    query = query.whereIn('state', states);
  }

  return query
    .eager('[legs, legs.booking]')
    .orderBy('startTime')
    .then(results => results);
}

function formatResponse(itineraries) {
  const filtered = itineraries.map(utils.removeNulls);

  return Promise.resolve({
    itineraries: filtered,
    maas: {},
  });
}

module.exports.respond = (event, callback) => {

  return Promise.all([
    Database.init(),
    parseAndValidateInput(event),
  ])
    .spread((knex, parsed) => fetchItineraries(parsed.identityId, parsed.startTime, parsed.endTime, parsed.states))
    .then(itineraries => formatResponse(itineraries))
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
