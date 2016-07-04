'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const stateLib = require('../../lib/states/index');
const models = require('../../lib/models/index');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

// Global knex connection variable
let knex;

function annotateState(itinerary) {
  return Object.assign({ state: 'ACTIVATED' }, itinerary);
}

function setActiveItinerary(identityId, itinerary) {
  if (!itinerary.id) {
    return Promise.reject(new Error('400 id is required'));
  }

  if (!itinerary.timestamp) {
    return Promise.reject(new Error('400 timestamp is required'));
  }

  console.log(`Activating user ${identityId} itinerary ${itinerary}`);
  const thingName = identityId.replace(/:/, '-');
  const payload = JSON.stringify({
    state: {
      reported: {
        itinerary: annotateState(itinerary),
      },
    },
  });

  console.log(`Thing shadow payload: ${payload}`);
  return stateLib.getState('Itinerary', knex, itinerary.id)
    .then(state => Promise.all([
      iotData.updateThingShadowAsync({
        thingName: thingName,
        payload: payload,
      }),
      stateLib.changeState('Itinerary', knex, itinerary.id, state, 'ACTIVATED'),
    ]))
  .spread((iotResponse, newState) => {
    console.log('iotResponse', iotResponse);
    const payload = JSON.parse(iotResponse.payload);
    return payload.state.reported.itinerary;
  });
}

module.exports.respond = function (event, callback) {
  return models.init()
    .then(_knex => {
      knex = _knex;
      return setActiveItinerary(event.identityId, event.itinerary);
    })
    .then(response => {
      callback(null, response);
    })
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    })
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
};
