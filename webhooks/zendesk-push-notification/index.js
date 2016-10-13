'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ region: process.env.AWS_REGION });
const stage = process.env.SERVERLESS_STAGE || 'dev';
const ARNSandbox = process.env.APNS_ARN_SANDBOX;
const ARN = process.env.APNS_ARN;
const validator = require('../../lib/validator');
const requestSchema = require('maas-schemas/prebuilt/maas-backend/webhooks/zendesk-push-notification/request.json');
const responseSchema = require('maas-schemas/prebuilt/maas-backend/webhooks/zendesk-push-notification/response.json');
const MaaSError = require('../../lib/errors/MaaSError');
const ValidationError = require('../../lib/validator/ValidationError');

Promise.promisifyAll(sns);

function forwardPushNotification(event) {

  // Helper for creating Apple Push Notification Service (APNS) endpoint
  function iOScreatePlatformEndpoint(token, isSandBox) {

    // structure for APNS
    const apnMessage = {
      aps: {
        alert: 'Reply to you feedback',
        badge: 0,
        sound: 'default',
        severity: 'information',
        type: 'ZendeskReply',
        data: {
          notification: event.notification,
        },
      },
    };
    const subject = 'Whim';

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

    return sns.createPlatformEndpointAsync(params)
      .then(response => sns.publishAsync({
        TargetArn: response.EndpointArn,
        MessageStructure: 'json',
        Subject: subject,
        Message: JSON.stringify({
          [APNSKey]: JSON.stringify(apnMessage),
        }),
      }))
      .then(response => {
        return Promise.resolve(`Zendesk push notification has been sent via '${APNSKey}', response: ${JSON.stringify(response)}`);
      })
      .catch(error => {
        return Promise.reject(new Error(`Zendesk push notification has been FAILED via '${APNSKey}', response: ${JSON.stringify(error)}`));
      });
  }

  const platformEndpointList = [];

  event.devices.forEach(device => {
    if (device.type === 'ios') {
      console.info('Message is being sent to iOS device: ' + device.identifier);

      // Queue all user devices (Apple) to the list
      platformEndpointList.push(iOScreatePlatformEndpoint(device.identifier));

      // If in development or test env, push also via sandbox (we don't know if
      // the device push token has been created for sandbox or production certificate)
      if (stage === 'dev' || stage === 'test') {
        platformEndpointList.push(iOScreatePlatformEndpoint(device.identifier, true));
      }
    } else if (device.type === 'android') {
      console.warn('Warning; ingoring push notification forwarding to Android; not supported');
    }
  });

  let successCount = 0;
  let failureCount = 0;
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
        results: {
          successCount: successCount,
          failureCount: failureCount,
        },
      });
    }
    return Promise.reject(new Error(`No successful push sends out of ${failureCount} tries.`));
  });

}

module.exports.respond = (event, callback) => {
  return Promise.resolve()
    .then(() => validator.validate(requestSchema, event))
    .catch(ValidationError, error => Promise.reject(new MaaSError(`Validation failed: ${error.message}`, 400)))
    .then(validated => forwardPushNotification(event))
    .then(response => validator.validate(responseSchema, response))
    .catch(ValidationError, error => {
      console.warn('Warning; Response validation failed, but responding with success');
      console.warn('Errors:', error.message);
      console.warn('Response:', JSON.stringify(error.object, null, 2));
      return Promise.resolve(error.object);
    })
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
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
