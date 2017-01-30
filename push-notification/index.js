'use strict';

const Promise = require('bluebird');
const lib = require('./lib');
const validator = require('../lib/validator');
const requestSchema = require('maas-schemas/prebuilt/maas-backend/push-notification/request.json');
const MaaSError = require('../lib/errors/MaaSError');
const ValidationError = require('../lib/validator/ValidationError');
const _uniqWith = require('lodash/uniqWith');
const _isEqual = require('lodash/isEqual');

function sendPushNotification(event) {
  const failedTokens = [];
  const succeededTokens = [];
  let syncSessionToken;

  return lib.fetchUserDevices(event.identityId)
    .then(response => {
      syncSessionToken = response.SyncSessionToken;

      // Remove record with null Value or null push token
      response.Records = response.Records.filter(item => item.Value !== null);

      // NOTE: The code here is used to make migration easier
      // Allowing push notification to digest both old and new profile/devices format
      // Might receive error as we blindly assume all device tokens are iOS
      response.Records = response.Records.map(record => {
        try {
          const devicePushToken = JSON.parse(record.Value).devicePushToken;
          if (!devicePushToken) throw new Error('Old device format detected');
          return record;
        } catch (error) {
          // Not in the new format, fallback
          console.warn('[Push notification] Detect old device record format, fallback to auto format');
          return {
            Key: record.Key,
            Value: JSON.stringify({
              devicePushToken: record.Value,
              deviceType: 'iOS',
              lastSuccess: Date.now(),
            }),
            SyncCount: record.SyncCount,
          };
        }
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
              }
              queue.push(lib.iOSsendPushNotification(event, token));
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
            console.warn(`[Push Notification] Push notfication to ${inspection.reason()} receive error, ignoring`);
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

          const promises = [];

          // If there are failed tokens, remove them from Cognito
          if (failedTokens.length > 0) {
            console.info(`[Push Notification] Trying to remove ${failedTokens.length} old push tokens`);
            promises.push(new Promise((resolve, reject) => {
              // Send non-duplication recordset to removal function
              lib.removeOldPushTokens(event.identityId, response.Records, _uniqWith(failedTokens, _isEqual), syncSessionToken)
                .then(res => resolve(res))
                .catch(error => reject(error));
            }));
          }

          // If there are succeeded tokens, update their lastSuccess on Cognito
          if (succeededTokens.length > 0) {
            console.info(`[Push Notification] Updating ${succeededTokens.length} working tokens`);
            // Send non-duplication recordset to updating function
            promises.push(new Promise((resolve, reject) => {
              lib.updateWorkingTokens(event.identityId, response.Records, _uniqWith(succeededTokens, _isEqual), syncSessionToken)
                .then(res => resolve(res))
                .catch(error => reject(error));
            }));
          }

          return Promise.all(promises);
        });
    });
}

module.exports.respond = (event, callback) => {
  console.info(`Sending push notification to user ${event.identityId} with event ${event}`);
  return Promise.resolve()
    .then(() => validator.validate(requestSchema, event))
    .catch(ValidationError, error => Promise.reject(new MaaSError(`Input validation error: ${error.message}`, 400)))
    .then(validated => sendPushNotification(validated))
    .then(response => callback(null, 'Push notification finished'))
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
