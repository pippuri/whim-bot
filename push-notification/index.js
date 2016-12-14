'use strict';

const Promise = require('bluebird');
const lib = require('./lib');
const validator = require('../lib/validator');
const requestSchema = require('maas-schemas/prebuilt/maas-backend/push-notification/request.json');
const responseSchema = require('maas-schemas/prebuilt/maas-backend/push-notification/response.json');
const MaaSError = require('../lib/errors/MaaSError');
const ValidationError = require('../lib/validator/ValidationError');

function sendPushNotification(event) {
  const failedTokens = [];
  const succeededTokens = [];
  let syncSessionToken;

  return lib.fetchUserDevices(event.identityId)
    .then(response => {
      syncSessionToken = response.SyncSessionToken;

      // Remove record with null Value or null push token
      response.Records = response.Records
                            .filter(item => item.Value !== null);
      // NOTE: The code here is used to make migration easier
      // Allowing push notification to digest both old and new profile/devices format
      // Might receive error as we blindly assume all device tokens are iOS

      response.Records = response.Records.map(record => {
        return {
          Key: record.Key,
          Value: JSON.stringify({
            devicePushToken: record.Value,
            deviceType: 'iOS',
            lastSuccess: Date.now(),
          }),
        };
      });

      // Device type grouping
      const recordsByType = lib.groupRecordsByType(response.Records);

      const queue = [];
      Object.keys(recordsByType).forEach(key => {
        switch (key) {
          case 'iosDevices':
            recordsByType[key].forEach(record => {
              const token = JSON.parse(record.Value).devicePushToken.replace(/\s/g, '');
              console.info('[Push Notification] Message is being sent to : ' + token);

              // Create Apple push notification sender
              // If in development or test env, push also via sandbox (we don't know if
              // the device push token has been created for sandbox or production certificate)
              if (process.env.SERVERLESS_STAGE === 'dev' || process.env.SERVERLESS_STAGE === 'test') {
                queue.push(lib.iOSsendPushNotification(event, token, true));
              } else {
                queue.push(lib.iOSsendPushNotification(event, token));
              }
            });
            break;
          case 'androidDevices':
            recordsByType[key].forEach(record => {
              const token = JSON.parse(record.Value).devicePushToken.replace(/\s/g, '');
              console.info('[Push Notification] Message is being sent to : ' + token);

              // Create Apple push notification sender
              queue.push(lib.androidSendPushNotification(event, token));
            });
            break;
          default: break;
        }
      });

      return Promise.all(queue.map(promise => promise.reflect()))
        .each(inspection => {
          if (inspection.isFulfilled()) {
            console.info('[Push Notification] Push notification succeeded to ' + inspection.value());
            succeededTokens.push(inspection.value());
          } else {
            console.warn('[Push Notification] Push notfication error, ignoring');
            // Failed inspection will return the failed token
            failedTokens.push(inspection.reason());
          }
          return Promise.resolve();
        })
        .then(() => {
          if (succeededTokens.length === failedTokens.length && succeededTokens.length === 0) {
            return Promise.reject(new MaaSError('[Push Notification] None device token exists for push notification'));
          }
          if (succeededTokens.length === 0) {
            return Promise.reject(new MaaSError('Failed to push notification to all devices'));
          }

          // If there are failed tokens, remove them from Cognito
          if (failedTokens.length > 0) {
            console.info('[Push Notification] Trying to remove old push tokens');
            return lib.removeOldPushTokens(event.identityId, response.Records, failedTokens, syncSessionToken)
              .then(() => Promise.resolve(`Failed to push notification to ${failedTokens.length} device(s)`));
          }

          // If there are succeeded tokens, update their lastSuccess on Cognito
          if (succeededTokens.length > 0) {
            console.log('[Push Notification] Updating working tokens');
            return lib.updateWorkingTokens(event.identityId, response.Records, succeededTokens, syncSessionToken)
              .then(() => Promise.resolve());
          }
          return Promise.resolve('Push notification succeeded for all tokens');
        });
    });
}

module.exports.respond = (event, callback) => {
  return Promise.resolve()
    .then(() => validator.validate(requestSchema, event))
    .catch(ValidationError, error => Promise.reject(new MaaSError(`Input validation error: ${error.message}`, 400)))
    .then(validated => sendPushNotification(validated))
    .then(response => validator.validate(responseSchema, response))
    .catch(ValidationError, error => {
      console.warn('Warning; Response validation failed, but responding with success');
      console.warn('Errors:', error.message);
      console.warn('Response:', JSON.stringify(error.object, null, 2));
      return Promise.resolve('Push notification sent to identityId ' + event.identityId);
    })
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
