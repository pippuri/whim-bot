'use strict';

const AWS = require('aws-sdk');
const Promise = require('bluebird');

const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
const sns = new AWS.SNS({ region: process.env.AWS_REGION });

const APNS_ARN = process.env.APNS_ARN;
const APNS_ARN_SANDBOX = process.env.APNS_ARN_SANDBOX;
const GCM_ARN = process.env.GCM_ARN;

/**
 * Fetch user devices information from Cognito
 * @param {UUID} identityId
 * @return {Object} Cognito dataset object
 */
function fetchUserDevices(identityId) {

  return Promise.resolve()
  .then(() => cognitoSync.listRecords({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
  }).promise());
}

/**
 * Filter Cognito records by device types
 * @param {Array<Object>} recordSet - Record set listed in the beginning of push-notification lambda
 */
function groupRecordsByType(recordSet) {
  return {
    iosDevices: recordSet.filter(record => JSON.parse(record.Value).deviceType === 'iOS'),
    androidDevices: recordSet.filter(record => JSON.parse(record.Value).deviceType === 'Android'),
  };
}

/**
 * Check the tokens and remove those that has lastSuccess
 * longer than 7 days
 *
 * @param {UUID} identityId
 * @param {Array<Object>} recordSet - Record set listed in the beginning of push-notification lambda
 * @param {Array<String>} tokens - tokens to run checks for
 * @param {string} syncSessionToken - last CognitoSync Listing session token
 *
 * @return {Object} response
 */
function removeOldPushTokens(identityId, recordSet, tokens, syncSessionToken) {
  const oldTokens = tokens
    .filter(token => {
      const record = recordSet.find(record => JSON.parse(record.Value).devicePushToken === token);
      return JSON.parse(record.Value).lastSuccess && Date.now() - JSON.parse(record.Value).lastSuccess > 7 * 60 * 60 * 1000;
    });

  return Promise.resolve()
    .then(() => cognitoSync.updateRecords({
      IdentityPoolId: process.env.COGNITO_POOL_ID,
      IdentityId: identityId,
      DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
      SyncSessionToken: syncSessionToken,
      RecordPatches: oldTokens.map(token => {
        const record = recordSet.find(record => JSON.parse(record.Value).devicePushToken === token);
        return {
          Op: 'remove',
          Key: record.Key,
          SyncCount: record.SyncCount,
        };
      }),
    }).promise())
  .then(() => Promise.resolve('Old tokens removed'))
  .catch(error => {
    console.warn('[Push notification] Error removing old push tokens: ' + error.message);
    return Promise.resolve();
  });
}

/**
 * Update lastSuccess argument for the input tokens
 *
 * @param {UUID} identityId
 * @param {Array<Object>} recordSet - Record set listed in the beginning of push-notification lambda
 * @param {Array<String>} tokens - tokens to run checks for
 * @param {string} syncSessionToken - last CognitoSync Listing session token
 *
 * @return {Promise} response
 */
function updateWorkingTokens(identityId, recordSet, tokens, syncSessionToken) {
  return Promise.resolve()
    .then(() => cognitoSync.updateRecords({
      IdentityPoolId: process.env.COGNITO_POOL_ID,
      IdentityId: identityId,
      DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
      SyncSessionToken: syncSessionToken,
      RecordPatches: tokens.map(token => {
        const record = recordSet.find(record => JSON.parse(record.Value).devicePushToken === token);
        const value = JSON.parse(record.Value);
        value.lastSuccess = Date.now();
        return {
          Op: 'replace',
          Key: record.Key,
          Value: JSON.stringify(value),
          SyncCount: record.SyncCount,
        };
      }),
    }).promise())
  .then(() => 'Working tokens updated')
  .catch(error => {
    console.warn('[Push notification] Error updating working push tokens: ' + error.message, '... ignoring');
  });
}

/**
 * Helper for creating Apple Push Notification Service (APNS) endpoint & sending a push to iOS device
 * @param {String} token - iOS push token
 * @param {Boolean} isSandBox - whether sending to Sandbox or not
 *
 * @return {String} Success token
 * @throws {String} Failed token
 */
function iOSsendPushNotification(event, token, isSandBox) {
  const APNSKey = isSandBox === true ? 'APNS_SANDBOX' : 'APNS';
  let endpointArn;
  // structure for APNS
  const apnMessage = {
    aps: {
      alert: event.message,
      badge: event.badge,
      sound: event.sound || 'default',
      severity: event.severity || 'Information',
      type: event.type,
      data: event.data,
    },
  };

  return Promise.resolve()
  .then(() => sns.createPlatformEndpoint({
    Token: token,
    PlatformApplicationArn: isSandBox === true ? APNS_ARN_SANDBOX : APNS_ARN,
  }).promise())
  .catch(error => {
    console.warn(`Platform endpoint creation FAILED via '${APNSKey}' for '${token}'`);
    console.warn(error.stack);
    return Promise.reject(token);
  })
  .then(response => (endpointArn = response.EndpointArn))
  // we have end-point, try to publish to that specific endpoint
  .then(() => sns.publish({
    TargetArn: endpointArn,
    MessageStructure: 'json',
    Subject: event.subject || 'Whim',
    Message: JSON.stringify({
      [APNSKey]: JSON.stringify(apnMessage),
    }),
  }).promise())
  // in case of endpoint is disabled, perform re-enabling and try once again
  .catch(error => {
    if (error.name !== 'EndpointDisabled' || !endpointArn) {
      console.warn(`Error: ${error.message}`);
      return Promise.reject(token);
    }
    console.warn(`[Push Notification] Endpoint disabled for '${endpointArn}', trying re-enable and send again...`);
    const params = {
      Attributes: {
        Enabled: 'true',
      },
      EndpointArn: endpointArn,
    };
    return sns.setEndpointAttributes(params).promise()
      .catch(error => {
        console.warn(`FAILED to re-enable endpoint for '${endpointArn}: ${error.message}'`);
        console.warn(error.stack);
        return Promise.reject(token);
      })
      // and try to send one more time
      .then(response => sns.publish({
        TargetArn: endpointArn,
        MessageStructure: 'json',
        Subject: event.subject || 'Whim',
        Message: JSON.stringify({
          [APNSKey]: JSON.stringify(apnMessage),
        }),
      }).promise())
      // Clean up endpointArn from Amazon
      // and ignore error
      .then(() => {
        console.info(`[Push Notification] Cleaning endpoint ARN ${endpointArn}`);
        return sns.deleteEndpoint({
          EndpointArn: endpointArn,
        }).promise()
        .catch(error => Promise.resolve(error));
      });
  })
  .then(response => {
    console.info(`[Push Notification] Push notification has been sent via '${APNSKey}', response: ${JSON.stringify(response)}`);
    return Promise.resolve(token);
  })
  .catch(error => {
    console.warn(`[Push Notification] Push notification has been FAILED via '${APNSKey}', response: ${JSON.stringify(error)}`);
    return Promise.reject(token);
  });
}

/**
 * Helper for sending a push to Android device through Google Cloud Messageing
 *
 * @param {Object} event - push payload
 * @param {String} token - Push token
 */
function androidSendPushNotification(event, token) {
  let endpointArn = '';

  const data = {
    data: Object.assign(event.data, { type: event.type, message: event.message }),
  };

  const gcmMessage = {
    GCM: JSON.stringify({ data }),
  };

  return Promise.resolve()
  .then(() => sns.createPlatformEndpoint({
    Token: token,
    PlatformApplicationArn: GCM_ARN,
  }).promise())
  .catch(error => {
    console.warn(`Platform endpoint creation FAILED via 'GCM' for '${token}: ${error.message}'`);
    console.warn(error.stack);
    return Promise.reject(token);
  })
  .then(response => (endpointArn = response.EndpointArn))
  // we have end-point, try to publish to that specific endpoint
  .then(() => sns.publish({
    TargetArn: endpointArn,
    MessageStructure: 'json',
    Subject: event.subject || 'Whim',
    Message: JSON.stringify(gcmMessage),
  }).promise())
  .catch(error => {
    if (error.name !== 'EndpointDisabled' || !endpointArn) {
      return Promise.reject(token);
    }
    console.warn(`[Push Notification] Endpoint disabled for '${endpointArn}', trying re-enable and send again...`);
    const params = {
      Attributes: {
        Enabled: 'true',
      },
      EndpointArn: endpointArn,
    };
    return sns.setEndpointAttributes(params).promise()
      .catch(error => {
        console.warn(`FAILED to re-enable endpoint for '${endpointArn}: ${error.message}'`);
        console.warn(error.stack);
        return Promise.reject(token);
      })
      // and try to send one more time
      .then(response => sns.publish({
        TargetArn: endpointArn,
        MessageStructure: 'json',
        Subject: event.subject || 'Whim',
        Message: JSON.stringify(gcmMessage),
      }).promise())
      // Clean up endpointArn from Amazon
      // and ignore error
      .then(() => {
        console.info(`[Push Notification] Cleaning endpoint ARN ${endpointArn}`);
        return sns.deleteEndpoint({
          EndpointArn: endpointArn,
        }).promise()
        .catch(error => Promise.resolve(error));
      });
  })
  .then(response => {
    console.info(`[Push Notification] Push notification has been sent via 'GCM', response: ${JSON.stringify(response)}`);
    return Promise.resolve(token);
  })
  .catch(error => {
    console.warn(`[Push Notification] Push notification has failed via 'GCM', response: ${JSON.stringify(error)}`);
    return Promise.reject(token);
  });
}

module.exports = {
  fetchUserDevices,
  groupRecordsByType,
  removeOldPushTokens,
  updateWorkingTokens,
  iOSsendPushNotification,
  androidSendPushNotification,
};
