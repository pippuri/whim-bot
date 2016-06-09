const Promise = require('bluebird');
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ region: process.env.AWS_REGION });
const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });

Promise.promisifyAll(sns);
Promise.promisifyAll(cognitoSync);

function sendPushNotification(event) {
  var params = {
    PlatformApplicationArn: process.env.APNS_ARN,

  };
  const subject = 'MaaS';
  var sendingStatus = [];

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
      params.Token = record.Key.replace(/\s/g, '');
      console.log('Message sent to : ' + params.Token);
      return sns.createPlatformEndpointAsync(params)
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
            console.log('def', error);
            return Promise.reject(error);
          }

          return Promise.resolve('done');
        });
    });
  });
}

module.exports.respond = (event, callback) => {
  sendPushNotification(event)
    .then(response => {
      if (response === undefined) {
        callback(null, 'Successfully sent message to all user devices');
      } else {
        callback(null, response);
      }
    })
    .catch(error => {
      callback(error);
    });
};
