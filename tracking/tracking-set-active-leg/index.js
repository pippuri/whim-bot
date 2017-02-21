'use strict';

const AWS = require('aws-sdk');
const stateMachine = require('../../lib/states/index').StateMachine;
const models = require('../../lib/models/index');
const MaaSError = require('../../lib/errors/MaaSError');
const Database = models.Database;

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });

/**
 * Return active itinerary data from thing shadow
 * @param  {UUID} identityId
 * @return {object} iotData response
 */
function getActiveItinerary(identityId) {
  const thingName = identityId.replace(/:/, '-');
  return iotData.getThingShadow({
    thingName: thingName,
  }).promise();
}

/**
 * check event input
 * @param  {object} event
 * @return {Promise -> empty}
 */
function validateInput(event) {
  if (!event.identityId) {
    return Promise.reject(new MaaSError('identityId is required', 400));
  }

  if (!event.leg) {
    return Promise.reject(new MaaSError('leg is required', 400));
  }

  if (!event.leg.id) {
    return Promise.reject(new MaaSError('leg.id is required', 400));
  }

  if (!event.leg.timestamp) {
    return Promise.reject(new MaaSError('leg.timestamp is required', 400));
  }

  return Promise.resolve();
}

/**
 * Change active leg data to thing shadow
 * @param {UUID} identityId
 * @param {object} itinerary
 * @param {object} leg
 * @return {object} iotResponse     Response from aws iot
 */
function setActiveLeg(identityId, itinerary, leg) {
  const thingName = identityId.replace(/:/, '-');
  const payload = JSON.stringify({
    state: {
      reported: {
        itinerary: {
          leg: {
            id: leg.id,
            timestamp: leg.timestamp,
            state: 'ACTIVATED',
          },
        },
      },
    },
  });

  console.info(`Thing shadow payload: ${JSON.stringify(payload)}`);
  return models.Leg.query().findById(leg.id)
    .then(oldLeg => {
      if (typeof oldLeg === typeof undefined) {
        const message = `No leg found with id ${leg.id}`;
        return Promise.reject(new MaaSError(message, 404));
      }

      // FIXME Reject if the user does not own this leg; DB change needed
      return Promise.all([
        stateMachine.changeState('Leg', oldLeg.id, oldLeg.state, 'ACTIVATED'),
        models.Leg.query().update({ state: 'ACTIVATED' }).where('id', leg.id),
        iotData.updateThingShadow({
          thingName: thingName,
          payload: payload,
        }).promise(),
      ]);
    })
    .then(promises => {
      const iotResponse = promises[2];
      console.info('iotResponse', iotResponse);
      return iotResponse;
    });
}

module.exports.respond = function (event, callback) {
  return Promise.all([
    Database.init(),
    validateInput(event),
  ])
    .then(() => getActiveItinerary(event.identityId))
    .then(itinerary => setActiveLeg(event.identityId, itinerary, event.leg))
    .then(
      response => Database.cleanup().then(() => response),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
