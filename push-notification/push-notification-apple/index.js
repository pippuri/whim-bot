'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ region: process.env.AWS_REGION });
const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
const stage = process.env.SERVERLESS_STAGE || 'dev';
const ARNSandbox = process.env.APNS_ARN_SANDBOX;
const ARN = process.env.APNS_ARN;


Promise.promisifyAll(sns);
Promise.promisifyAll(cognitoSync);

function sendPushNotification(event) {

  const apnMessage = {
    aps: {
      alert: event.message,
      badge: event.badge,
      sound: 'default',
    },
  };

  // Queue all user devices (Apple) to the list
  function iOScreatePlatformEndpoint(token, isSandBox) {
    const params = {
      Token: token,
    };
    const subject = 'MaaS';
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
        return Promise.resolve(`Push notification has been sent via '${APNSKey}', response: ${JSON.stringify(response)}`);
      })
      .catch(error => {
        return Promise.reject(`Push notification has been FAILED via '${APNSKey}', response: ${JSON.stringify(error)}`);
      });
  }

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: event.identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
  })
  .then(response => {
    response.Records.map(record => {
      const platformEndpointList = [];
      const token = record.Value.replace(/\s/g, '');
      console.info('Message is being sent to : ' + token);

      // Queue all user devices (Apple) to the list
      platformEndpointList.push(iOScreatePlatformEndpoint(token));

      // If in development or test env, push also via sandbox (we don't know if
      // the device push token has been created for sandbox or production certificate)
      if (stage === 'dev' || stage === 'test') {
        platformEndpointList.push(iOScreatePlatformEndpoint(token, true));
      }

      return Promise.all(platformEndpointList.map(promise => {
        return promise.reflect();
      }))
      .each(inspection => {
        if (inspection.isFulfilled()) {
          console.info(inspection.value());
        } else {
          console.error(inspection.reason());
        }
      });
    });
  });
}

module.exports.respond = (event, callback) => {
  sendPushNotification(event)
    .then(response => {
      if (response === undefined) {
        callback(null, 'The function has finished');
      } else {
        callback(response);
      }
    })
    .catch(error => {
      callback(error);
    });
};
