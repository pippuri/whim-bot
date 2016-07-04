'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const stateLib = require('../../lib/states/index');
const models = require('../../lib/models/index');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);


// Global knex variable to contain knex connection info
let knex;

function getActiveItinerary(identityId) {
  const thingName = identityId.replace(/:/, '-');
  return iotData.getThingShadowAsync({
    thingName: thingName,
  })
  .then(response => {
    const payload = JSON.parse(response.payload);
    if (payload && payload.state && payload.state.reported && payload.state.reported.itinerary) {
      return payload.state.reported.itinerary;
    }

    return Promise.reject(new Error('404 No Active Itinerary'));
  });
}

function setActiveLeg(identityId, itinerary, legId, timestamp) {
  if (!legId) {
    return Promise.reject(new Error('400 id is required'));
  }

  if (!timestamp) {
    return Promise.reject(new Error('400 timestamp is required'));
  }

  const thingName = identityId.replace(/:/, '-');
  const payload = JSON.stringify({
    state: {
      reported: {
        itinerary: {
          id: itinerary.id,
          timestamp: itinerary.timestamp,
          leg: {
            id: legId,
            timestamp: timestamp,
            state: 'ACTIVATED',
          },
        },
      },
    },
  });
  console.log('Thing shadow payload:', payload);
  return stateLib.getState('Leg', knex, legId)
    .then(state => Promise.all([
      iotData.updateThingShadowAsync({
        thingName: thingName,
        payload: payload,
      }),
      stateLib.changeState('Leg', knex, legId, state, 'ACTIVATED'),
    ]))
  .spread((iotResponse, newState) => {
    const payload = JSON.parse(iotResponse.payload);
    return payload.state.reported.itinerary && payload.state.reported.itinerary.leg || null;
  });
}

module.exports.respond = function (event, callback) {
  return models.init()
    .then(_knex => {
      knex = _knex;
      return getActiveItinerary(event.identityId);
    })
    .then(itinerary => {
      return setActiveLeg(event.identityId, itinerary, event.leg.id, event.leg.timestamp);
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
