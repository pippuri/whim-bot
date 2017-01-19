'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
const sns = new AWS.SNS({ region: process.env.AWS_REGION });
Promise.promisifyAll(sns);
Promise.promisifyAll(cognitoSync);

const APNS_ARN = process.env.APNS_ARN;
const GCM_ARN = process.env.GCM_ARN;

/**
 * Fetch user devices information from Cognito
 * @param {UUID} identityId
 * @return {Object} Cognito dataset object
 */
function fetchUserDevices(identityId) {

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
  });
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
  const oldTokens = tokens.filter(token => {
    const record = recordSet.find(record => JSON.parse(record.Value).devicePushToken === token);
    return JSON.parse(record.Value).lastSuccess && Date.now() - JSON.parse(record.Value).lastSuccess > 7 * 60 * 60 * 1000;
  });

  return cognitoSync.updateRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
    SyncSessionToken: syncSessionToken,
    RecordPatches: oldTokens.map(token => {
      const record = recordSet.find(record => JSON.parse(record.Value).devicePushToken === token);
      return {
        Op: 'remove',
        Key: record.Key,
        SyncCount: record ? record.SyncCount : 0,
      };
    }),
  })
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
  return cognitoSync.updateRecordsAsync({
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
        SyncCount: record ? record.SyncCount : 0,
      };
    }),
  })
  .then(() => Promise.resolve('Working tokens updated'))
  .catch(error => {
    console.warn('[Push notification] Error removing old push tokens: ' + error.message, '... ignoring');
    return Promise.resolve();
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
      alert: event.data.message,
      badge: event.data.badge,
      sound: event.data.sound || 'default',
      severity: event.data.severity || 'information',
      type: event.data.type,
      data: event.data,
    },
  };

  return new Promise((resolve, reject) => {
    sns.createPlatformEndpointAsync({
      Token: token,
      PlatformApplicationArn: APNS_ARN,
    })
    .catch(error => {
      console.warn(`Platform endpoint creation FAILED via '${APNSKey}' for '${token}'`);
      console.warn(error.stack);
      return reject(token);
    })
    .then(response => (endpointArn = response.EndpointArn))
    // we have end-point, try to publish to that specific endpoint
    .then(() => sns.publishAsync({
      TargetArn: endpointArn,
      MessageStructure: 'json',
      Subject: event.subject || 'Whim',
      Message: JSON.stringify({
        [APNSKey]: JSON.stringify(apnMessage),
      }),
    }))
    // in case of endpoint is disabled, perform re-enabling and try once again
    .catch(error => {
      if (error.name !== 'EndpointDisabled' || !endpointArn) {
        console.warn(`Error: ${error.message}`);
        return reject(token);
      }
      console.warn(`[Push Notification] Endpoint disabled for '${endpointArn}', trying re-enable and send again...`);
      const params = {
        Attributes: {
          Enabled: 'true',
        },
        EndpointArn: endpointArn,
      };
      return sns.setEndpointAttributesAsync(params)
        .catch(error => {
          console.warn(`FAILED to re-enable endpoint for '${endpointArn}: ${error.message}'`);
          console.warn(error.stack);
          return reject(token);
        })
        // and try to send one more time
        .then(response => sns.publishAsync({
          TargetArn: endpointArn,
          MessageStructure: 'json',
          Subject: event.subject || 'Whim',
          Message: JSON.stringify({
            [APNSKey]: JSON.stringify(apnMessage),
          }),
        }))
        // Clean up endpointArn from Amazon
        // and ignore error
        .then(() => {
          console.log(`[Push Notification] Cleaning endpoint ARN ${endpointArn}`);
          return sns.deleteEndpoint({
            EndpointArn: endpointArn,
          })
          .catch(error => Promise.resolve(error));
        });
    })
    .then(response => {
      console.info(`[Push Notification] Push notification has been sent via '${APNSKey}', response: ${JSON.stringify(response)}`);
      return resolve(token);
    })
    .catch(error => {
      console.warn(`[Push Notification] Push notification has been FAILED via '${APNSKey}', response: ${JSON.stringify(error)}`);
      return reject(token);
    });
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

  const gcmMessage = {
    GCM: JSON.stringify({
      data: Object.assign(event.data, event.type, event.message),
    }),
  };

  return new Promise((resolve, reject) => {
    sns.createPlatformEndpointAsync({
      Token: token,
      PlatformApplicationArn: GCM_ARN,
    })
    .catch(error => {
      console.warn(`Platform endpoint creation FAILED via 'GCM' for '${token}: ${error.message}'`);
      console.warn(error.stack);
      return reject(token);
    })
    .then(response => (endpointArn = response.EndpointArn))
    // we have end-point, try to publish to that specific endpoint
    .then(() => sns.publishAsync({
      TargetArn: endpointArn,
      MessageStructure: 'json',
      Subject: event.subject || 'Whim',
      Message: JSON.stringify(gcmMessage),
    }))
    .catch(error => {
      if (error.name !== 'EndpointDisabled' || !endpointArn) {
        return reject(token);
      }
      console.warn(`[Push Notification] Endpoint disabled for '${endpointArn}', trying re-enable and send again...`);
      const params = {
        Attributes: {
          Enabled: 'true',
        },
        EndpointArn: endpointArn,
      };
      return sns.setEndpointAttributesAsync(params)
        .catch(error => {
          console.warn(`FAILED to re-enable endpoint for '${endpointArn}: ${error.message}'`);
          console.warn(error.stack);
          return reject(token);
        })
        // and try to send one more time
        .then(response => sns.publishAsync({
          TargetArn: endpointArn,
          MessageStructure: 'json',
          Subject: event.subject || 'Whim',
          Message: JSON.stringify(gcmMessage),
        }))
        // Clean up endpointArn from Amazon
        // and ignore error
        .then(() => {
          console.log(`[Push Notification] Cleaning endpoint ARN ${endpointArn}`);
          return sns.deleteEndpoint({
            EndpointArn: endpointArn,
          })
          .catch(error => Promise.resolve(error));
        });
    })
    .then(response => {
      console.info(`[Push Notification] Push notification has been sent via 'GCM', response: ${JSON.stringify(response)}`);
      return resolve(token);
    })
    .catch(error => {
      console.warn(`[Push Notification] Push notification has failed via 'GCM', response: ${JSON.stringify(error)}`);
      return reject(token);
    });
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
