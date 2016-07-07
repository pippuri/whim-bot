'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const stateLib = require('../../lib/states/index');
const models = require('../../lib/models/index');
const MaaSError = require('../../lib/errors/MaaSError');
const Database = models.Database;

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function getActiveItinerary(identityId) {
  const thingName = identityId.replace(/:/, '-');
  return iotData.getThingShadowAsync({
    thingName: thingName,
  });
}

function validateInput(event) {
  if (!event.identityId) {
    return Promise.reject(new Error('400 identityId is required'));
  }

  if (!event.leg) {
    return Promise.reject(new Error('400 leg is required'));
  }

  if (!event.leg.id) {
    return Promise.reject(new Error('400 leg.id is required'));
  }

  if (!event.leg.timestamp) {
    return Promise.reject(new Error('400 leg.timestamp is required'));
  }

  return Promise.resolve();
}

function setActiveLeg(identityId, itinerary, leg) {
  const thingName = identityId.replace(/:/, '-');
  const payload = JSON.stringify({
    state: {
      reported: {
        itinerary: {
          id: itinerary.id,
          timestamp: itinerary.timestamp,
          leg: {
            id: leg.id,
            timestamp: leg.timestamp,
            state: 'ACTIVATED',
          },
        },
      },
    },
  });

  console.log(`Thing shadow payload: ${JSON.stringify(payload)}`);
  return models.Leg.query().findById(leg.id)
    .then(oldLeg => Promise.all([
      stateLib.changeState('Leg', oldLeg.id, oldLeg.state, 'ACTIVATED'),
      models.Leg.query().update({ state: 'ACTIVATED' }).where('id', leg.id),
      iotData.updateThingShadowAsync({
        thingName: thingName,
        payload: payload,
      }),
    ]))
    .spread((changedState, newLeg, iotResponse) => {
      console.log('iotResponse', iotResponse);
      return iotResponse;
    });
}

module.exports.respond = function (event, callback) {
  return Promise.all([
    Database.init(),
    validateInput(event),
    getActiveItinerary(event.identityId),
  ])
    .spread((knex, validation, itinerary) => setActiveLeg(event.identityId, itinerary, event.leg))
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
