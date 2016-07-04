'use strict';

const Promise = require('bluebird');
const allowedFields = require('../../lib/models/editableFields.json');
const models = require('../../lib/models/index');
const MaasError = require('../../lib/errors/MaaSError');
const _ = require('lodash');
const stateLib = require('../../lib/states/index');

let knex;

const allowedItineraryFields = allowedFields.Itinerary;
const returnFields = ['id'];

function updateItinerary(event) {

  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaasError('Missing identityId input', 401));
  }

  if (!event.hasOwnProperty('itineraryId') || !event.itineraryId.match(/[A-F0-9]{8}(-[A-F0-9]{4}){3}-[A-F0-9]{12}/g)) {
    return Promise.reject(new MaasError('Missing or invalid itineraryId'));
  }

  if (!event.hasOwnProperty('payload') || Object.keys('payload').length === 0) {
    return Promise.reject(new MaasError('Payload empty. No update was processed'));
  }

  // Compare input key vs allowed keys
  Object.keys(event.payload).map(key => { // eslint-disable-line consistent-return
    if (!_.includes(allowedItineraryFields, key.toLowerCase())) {
      return Promise.reject(new MaasError(`Request contains unallowed field(s), allow only [${allowedItineraryFields}]`));
    }
  });

  // Add modified time
  const modifiedTime = new Date().getTime();
  event.payload.modified = new Date(modifiedTime).toISOString();

  // Get old state
  return knex.select()
    .from('Itinerary')
    .where('id', event.itineraryId)
    .then(_itinerary => {
      const itinerary = _itinerary[0];
      const oldState = _itinerary.state;

      // Handle item not exist
      if (typeof itinerary === typeof undefined) {
        return Promise.reject(new MaasError(`No item found for itineraryId ${event.itineraryId}, item might not exist`, 500));
      }

      // Handle item not having oldState
      if (typeof oldState === typeof undefined) {
        return Promise.reject(new MaasError(`oldState not found for itineraryId ${event.itineraryId}, item might not exist`, 500));
      }

      // Double check if oldState of the responded item is still valid
      if (event.payload.state || !stateLib.isStateValid('Itinerary', oldState, event.payload.state)) {
        return Promise.reject('State unavailable');
      }
      const promiseQueue = [];

      // Queue up state change process
      if (event.payload.state) {
        promiseQueue.push(stateLib.changeState('Itinerary', knex, event.itineraryId, oldState, event.payload.state));
        delete event.payload.state;
      }

      // Queue up other fields update
      promiseQueue.push(
        knex.update(event.payload, returnFields.concat(Object.keys(event.payload)))
          .into('Itinerary')
          .where('id', event.itineraryId)
      );

      // Process the queue
      return Promise.all(promiseQueue);
    })
    .then(response => {
      if (response.length === 0) {
        return Promise.reject(new MaasError(`Itinerary id ${event.bookingId} not updated, server error`, 500));
      } else if (response.length !== 1 || response.length !== 2) { // There could be maximum 2 task queued which is state change task, and item update task
        return Promise.reject(new MaasError(`Task queue for id ${event.bookingId} failed, if payload contained 'state' input, please check if its validity!`, 500));
      }
      console.warn(response);

      // Update state will always be the first task on the queue
      // Update others will always be the last.
      const booking = response[response.length - 1];
      return booking;
    });
}

module.exports.respond = (event, callback) => {
  return models.init()
    .then(_knex => {
      knex = _knex;
      return updateItinerary(event);
    })
    .then(response => {
      callback(null, response);
    })
    .then(error => {
      callback(error);
    })
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
};
