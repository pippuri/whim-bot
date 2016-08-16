'use strict';

const AWS = require('aws-sdk');
const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const stateMachine = require('../../lib/states/index').StateMachine;
const Database = models.Database;
const bus = require('../../lib/service-bus/index.js');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

/**
 * Validate event input
 * @param  {Object} event input event
 * @return {Promise -> _empty}
 */
function validateInput(event) {
  if (!event.identityId) {
    return Promise.reject(new MaaSError('IdentityId is required', 400));
  }

  if (!event.itinerary) {
    return Promise.reject(new MaaSError('Itinerary is required', 400));
  }

  if (!event.itinerary.id) {
    return Promise.reject(new MaaSError('Itinerary.id is required', 400));
  }

  if (!event.itinerary.timestamp) {
    return Promise.reject(new MaaSError('Itinerary.timestamp is required', 400));
  }

  return Promise.resolve();
}

/**
 * Annotate Itinerary with more data
 * @param  {Object} itinerary
 * @return {Object} new itinerary with more data
 */
function annotateItinerary(itinerary) {
  return Object.assign({}, itinerary, {
    state: 'ACTIVATED',
    legId: itinerary.legId,
  });
}

/**
 * Activate the starting leg of the itinerary
 * @default First leg of the itinerary
 * @param {UUID} legId - Optional - Alternatively start the itinerary at the leg with this id
 */
function activateStartingLeg(identityId, itinerary, legId, timestamp) {
  console.info(`Activate starting leg, identityid=${identityId}, itineraryId:=${JSON.stringify(itinerary.id)}, legId=${legId}`);

  // If no input legId given, use the first leg
  if (!legId) {
    legId = itinerary.legs[0].id;
  }

  // else use provided legId
  const payload = {
    identityId: identityId,
    leg: {
      id: legId,
      timestamp: timestamp,
    },
  };
  console.log('Payload', JSON.stringify(payload, null, 2));
  return bus.call('MaaS-tracking-set-active-leg', payload);
}

/**
 * Update IoT thing shadow with new active itinerary and first activated leg
 * @param {UUID} identityId
 * @param {Object} itineraryData object encapsulating itineraryId,timestamp and legId
 */
function setActiveItinerary(identityId, itineraryData) {

  console.info(`Activating user ${identityId} itinerary ${JSON.stringify(itineraryData)}`);
  const thingName = identityId.replace(/:/, '-');

  const payload = JSON.stringify({
    state: {
      reported: {
        itinerary: annotateItinerary(itineraryData),
      },
    },
  });

  // TODO Query with ID and identityId would be more secure bet
  return models.Itinerary.query().findById(itineraryData.id)
    .then(oldItinerary => {
      if (typeof oldItinerary === typeof undefined) {
        const message = `No itinerary found with id ${itineraryData.id}`;
        return Promise.reject(new MaaSError(message, 404));
      }

      // Validate state change
      if (!stateMachine.isStateValid('Itinerary', oldItinerary.state, 'ACTIVATED')) {
        const message = `Invalid state change request from ${oldItinerary.state} to ACTIVATED`;
        return Promise.reject(new MaaSError(message, 400));
      }

      return Promise.all([
        stateMachine.changeState('Itinerary', oldItinerary.id, oldItinerary.state, 'ACTIVATED'),
        models.Itinerary.query()
          .patchAndFetchById(itineraryData.id, { state: 'ACTIVATED' })
          .eager('[legs]'),
        iotData.updateThingShadowAsync({
          thingName: thingName,
          payload: payload,
        }),
      ]);
    })
    .spread((changedState, updatedItinerary, iotResponse) => {
      if (!updatedItinerary) {
        const message = `Itinerary ${itineraryData.id} update failed`;
        return Promise.reject(new MaaSError(message, 500));
      }

      return activateStartingLeg(identityId, updatedItinerary, itineraryData.legId, itineraryData.timestamp);
    })
    .then(iotResponse => Promise.resolve({
      payload: JSON.parse(iotResponse.payload),
    }));
}

module.exports.respond = function (event, callback) {
  return Promise.all([Database.init(), validateInput(event)])
    .then(() => setActiveItinerary(event.identityId, event.itinerary))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn(_error.stack);
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
