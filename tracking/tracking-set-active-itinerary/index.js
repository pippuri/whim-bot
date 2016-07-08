'use strict';

const AWS = require('aws-sdk');
const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const stateMachine = require('../../lib/states/index').StateMachine;
const Database = models.Database;

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function annotateState(itinerary) {
  return Object.assign({}, itinerary, { state: 'ACTIVATED' });
}

function validateInput(event) {
  if (!event.identityId) {
    return Promise.reject(new Error('400 identityId is required'));
  }

  if (!event.itinerary) {
    return Promise.reject(new Error('400 itinerary is required'));
  }

  if (!event.itinerary.id) {
    return Promise.reject(new Error('400 itinerary.id is required'));
  }

  if (!event.itinerary.timestamp) {
    return Promise.reject(new Error('400 itinerary.timestamp is required'));
  }

  return Promise.resolve();
}

function setActiveItinerary(identityId, itinerary) {

  console.log(`Activating user ${identityId} itinerary ${JSON.stringify(itinerary)}`);
  const thingName = identityId.replace(/:/, '-');
  const payload = JSON.stringify({
    state: {
      reported: {
        itinerary: annotateState(itinerary),
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
      return iotResponse;
    });
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
