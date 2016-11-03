'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ region: process.env.AWS_REGION });
const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
const stage = process.env.SERVERLESS_STAGE || 'dev';
const ARNSandbox = process.env.APNS_ARN_SANDBOX;
const ARN = process.env.APNS_ARN;
const validator = require('../../lib/validator');
const requestSchema = require('maas-schemas/prebuilt/maas-backend/push-notification/push-notification-apple/request.json');
const responseSchema = require('maas-schemas/prebuilt/maas-backend/push-notification/push-notification-apple/response.json');
const MaaSError = require('../../lib/errors/MaaSError');
const ValidationError = require('../../lib/validator/ValidationError');

Promise.promisifyAll(sns);
Promise.promisifyAll(cognitoSync);

function sendPushNotification(event) {

  // Helper for creating Apple Push Notification Service (APNS) endpoint & sending a push
  function iOSsendPushNotification(token, isSandBox) {

    // structure for APNS
    const apnMessage = {
      aps: {
        alert: event.message,
        badge: event.badge,
        sound: event.sound || 'default',
        severity: event.severity || 'information',
        type: event.type,
        data: event.data,
      },
    };
    const subject = event.subject || 'Whim';

    const params = {
      Token: token,
    };
    let APNSKey;

    if (isSandBox === true) {
      APNSKey = 'APNS_SANDBOX';
      params.PlatformApplicationArn = ARNSandbox;
    } else {
      APNSKey = 'APNS';
      params.PlatformApplicationArn = ARN;
    }

    let endpointArn;
    return sns.createPlatformEndpointAsync(params)
      .catch(error => {
        console.warn(`Platform endpoint creation FAILED via '${APNSKey}' for '${token}'`);
        console.warn(error.stack);
        return Promise.reject(error);
      })
      .then(response => {
        endpointArn = response.EndpointArn;
        return Promise.resolve();
      })
      // we have end-point, try to send
      .then(() => sns.publishAsync({
        TargetArn: endpointArn,
        MessageStructure: 'json',
        Subject: subject,
        Message: JSON.stringify({
          [APNSKey]: JSON.stringify(apnMessage),
        }),
      }))
      // in case of endpoint is disabled, perform re-enabling and try once again
      .catch(error => {
        if (error.name !== 'EndpointDisabled' || !endpointArn) {
          return Promise.reject(error);
        }
        console.warn(`Endpoint disabled for '${endpointArn}', trying re-enable and send again...`);
        const params = {
          Attributes: {
            Enabled: 'true',
          },
          EndpointArn: endpointArn,
        };
        return sns.setEndpointAttributesAsync(params)
          .catch(error => {
            console.warn(`FAILED to re-enable endpoint for '${endpointArn}'`);
            console.warn(error.stack);
            return Promise.reject(error);
          })
          // and try to send one more time
          .then(response => sns.publishAsync({
            TargetArn: endpointArn,
            MessageStructure: 'json',
            Subject: subject,
            Message: JSON.stringify({
              [APNSKey]: JSON.stringify(apnMessage),
            }),
          }));
      })
      .then(response => {
        return Promise.resolve(`Push notification has been sent via '${APNSKey}', response: ${JSON.stringify(response)}`);
      })
      .catch(error => {
        console.warn(`Push notification has been FAILED via '${APNSKey}', response: ${JSON.stringify(error)}`);
        return Promise.reject(error);
      });
  }

  let successCount = 0;
  let failureCount = 0;

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: event.identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
  })
  .then(response => {
    const platformEndpointList = [];
    response.Records.map(record => {
      const token = record.Value.replace(/\s/g, '');
      console.info('Message is being sent to : ' + token);

      // Create Apple push notification sender
      platformEndpointList.push(iOSsendPushNotification(token));

      // If in development or test env, push also via sandbox (we don't know if
      // the device push token has been created for sandbox or production certificate)
      if (stage === 'dev' || stage === 'test') {
        platformEndpointList.push(iOSsendPushNotification(token, true));
      }
    });

    return Promise.all(platformEndpointList.map(promise => {
      return promise.reflect();
    }))
    .each(inspection => {
      if (inspection.isFulfilled()) {
        console.info(inspection.value());
        successCount++;
      } else {
        console.error('Push notfication error, ignoring:', inspection.reason());
        failureCount++;
      }
    })
    .then(() => {
      if (successCount > 0) {
        return Promise.resolve({
          identityId: event.identityId,
          results: {
            successCount: successCount,
            failureCount: failureCount,
          },
        });
      }
      return Promise.reject(new MaaSError(`No successful push sends out of ${failureCount} tries.`, 500));
    });

  });
}

module.exports.respond = (event, callback) => {
  return Promise.resolve()
    .then(() => validator.validate(requestSchema, event))
    .catch(ValidationError, error => Promise.reject(new MaaSError(`Validation failed: ${error.message}`, 400)))
    .then(validated => sendPushNotification(validated))
    .then(response => validator.validate(responseSchema, response))
    .catch(ValidationError, error => {
      console.warn('Warning; Response validation failed, but responding with success');
      console.warn('Errors:', error.message);
      console.warn('Response:', JSON.stringify(error.object, null, 2));
      return Promise.resolve(error.object);
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
