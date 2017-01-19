'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const Templates = (new (require('serverless'))()).classes.Templates;
const cognitoSync = new AWS.CognitoSync({ region: 'eu-west-1' });
const cognitoIdentity = new AWS.CognitoIdentity({ region: 'eu-west-1' });
const sns = new AWS.SNS({ region: 'eu-west-1' });
Promise.promisifyAll(sns);
Promise.promisifyAll(cognitoSync);
Promise.promisifyAll(cognitoIdentity);

/**************************************************************************************
 *
 *
 *
 *  Intention when writting this script is to update the format of Cognito dataset records.
 *  Modify updateCognitoDeviceFormat() as you see fit. But beware of consequence!!!
 *  See example on how to reformat the data in the commented field "Value"
 *  inside updateCognitoDeviceFormat()
 *
 *
 **************************************************************************************/

function loadEnvironment(stage) {
  // Default to dev
  stage = stage || 'dev';

  const values = require(`../_meta/variables/s-variables-${stage}.json`);
  const variables = (new Templates(values, '../s-templates.json')).toObject();
  for (let key of Object.keys(variables)) { // eslint-disable-line prefer-const
    process.env[key] = variables[key];
  }
}

function updateCognitoDeviceFormat(identityId, recordSet, syncSessionToken) {
  return cognitoSync.updateRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
    SyncSessionToken: syncSessionToken,
    RecordPatches: recordSet.map(item => {
      // return {
      //   Op: 'replace',
      //   Key: item.Key,
      //   Value: JSON.stringify({
      //     devicePushToken: item.Value,
      //     deviceType: 'iOS',
      //     lastSuccess: Date.now(),
      //   }),
      //   // Value: JSON.parse(item.Value).devicePushToken,
      //   SyncCount: item ? item.SyncCount : 0,
      // };
      return {
        Op: 'remove',
        Key: item.Key,
        SyncCount: item ? item.SyncCount : 0,
      };
    }),
  });
}

let NextToken1;
let records = [];
let NextToken2;

function fetchDeviceDataset(identityId) {
  return cognitoSync.listRecordsAsync({
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
    IdentityId: identityId,
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    NextToken: NextToken1 || undefined,
  });
}

function fetchAllIdentityFromPool() {
  return cognitoIdentity.listIdentitiesAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    MaxResults: 60,
    NextToken: NextToken2 || undefined,
  })
  .then(response => {
    records = records.concat(response.Identities);
    if (response.NextToken) {
      NextToken2 = response.NextToken;
      return fetchAllIdentityFromPool();
    }

    return Promise.resolve(records.map(item => item.IdentityId));
  });
}

loadEnvironment(process.env.SERVERLESS_STAGE);

fetchAllIdentityFromPool()
  .then(identities => {
    return Promise.all(
      identities
        .map(identity => fetchDeviceDataset(identity)
        .then(response => updateCognitoDeviceFormat(identity, response.Records, response.SyncSessionToken))));
  });
