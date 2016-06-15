'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ region: process.env.AWS_REGION });
const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });

Promise.promisifyAll(sns);
Promise.promisifyAll(cognitoSync);

function sendPushNotification(event) {
  const params = {
    PlatformApplicationArn: process.env.APNS_ARN,
  };
  const subject = 'MaaS';

  const apnMessage = {
    aps: {
      alert: event.message,
      badge: event.badge,
      sound: 'default',
    },
  };

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: event.identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
  })
  .then(response => {
    response.Records.map(record => {
      const platformEndpointList = [];
      params.Token = record.Key.replace(/\s/g, '');
      console.log('Message is being sent to : ' + params.Token);

      // Queue all user devices ( Apple ) to the list
      platformEndpointList.push(sns.createPlatformEndpointAsync(params)
        .then((response, error) => {
          if (error) {
            console.log('abc', error);
            return Promise.reject(error);
          }

          return sns.publishAsync({
            TargetArn: response.EndpointArn,
            MessageStructure: 'json',
            Subject: subject,
            Message: JSON.stringify({
              APNS_SANDBOX: JSON.stringify(apnMessage),
            }),
          });
        })
        .then((response, error) => {
          if (error) {
            return Promise.reject(error);
          }

          return Promise.resolve(`Push notification has been sent to ${response}`);
        })
      );

      return Promise.all(platformEndpointList.map(promise => {
        return promise.reflect();
      }))
      .each(inspection => {
        if (inspection.isFulfilled()) {
          console.log('This request was fulfilled with response: ', inspection.value());
        } else {
          console.error('One request has been rejected with error: ', inspection.reason());
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
