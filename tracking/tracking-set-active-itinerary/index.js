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
 * Get first leg of the itinerary, based on startTime of the leg
 * @param  {UUID} itineraryId
 * @return {String} legId
 */
function getFirstLegId(itineraryId) {

  return Database._knex
    .select('id', 'startTime')
    .from('Leg')
    .where('itineraryId', itineraryId)
    .then(response =>
      response
        .map(item => {
          return {
            id: item.id,
            startTime: new Date(item.startTime).valueOf(),
          };
        })
        .sort((a, b) => {
          return a.startTime - b.startTime;
        })[0].id // index 0 means the lowest startTime -> the first leg
      );
}

/**
 * Activate the starting leg of the itinerary
 * @default First leg of the itinerary
 * @param {UUID} legId - Optional - Alternatively start the itinerary at the leg with this id
 */
function activateStartingLeg(identityId, itinerary, legId) {

  // If no input legId is presence
  if (!legId || legId === null || legId === '') {
    // Set active leg to be the first leg of the itinerary || sorted by startTime
    return getFirstLegId(itinerary.id)
      .then(firstLegId => {
        return bus.call('MaaS-tracking-set-active-leg', {
          identityId: identityId,
          leg: {
            id: firstLegId,
            timestamp: itinerary.timestamp,
          },
        });
      });
  }

  // else use provided legId
  return bus.call('MaaS-tracking-set-active-leg', {
    identityId: identityId,
    leg: {
      id: legId,
      timestamp: itinerary.timestamp,
    },
  });
}

/**
 * Update IoT thing shadow with new active itinerary and first activated leg
 * @param {UUID} identityId
 * @param {Object} itinerary
 */
function setActiveItinerary(identityId, itinerary) {

  console.log(`Activating user ${identityId} itinerary ${JSON.stringify(itinerary)}`);
  const thingName = identityId.replace(/:/, '-');

  const payload = JSON.stringify({
    state: {
      reported: {
        itinerary: annotateItinerary(itinerary),
      },
    },
  });

  console.log(`Thing shadow itinerary: ${payload}`);

  // TODO Query with ID and identityId would be more secure bet
  return models.Itinerary.query().findById(itinerary.id)
    .then(oldItinerary => Promise.all([
      stateMachine.changeState('Itinerary', oldItinerary.id, oldItinerary.state, 'ACTIVATED'),
      models.Itinerary.query().update({ state: 'ACTIVATED' }).where('id', itinerary.id),
      iotData.updateThingShadowAsync({
        thingName: thingName,
        payload: payload,
      }),
    ]))
    .spread((changedState, newItinerary, iotResponse) => {
      console.log('iotResponse', iotResponse);
      return activateStartingLeg(identityId, itinerary, itinerary.legId);
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
