'use strict';

const mockUpdateResponse = require('./mockDynamoUpdateProfile.json');
const mockProfiles = require('./mockDynamoProfiles.json');
const Promise = require('bluebird');

const cafecafe4profile = mockProfiles.find(item => item.identityId === 'eu-west-1:00000000-cafe-cafe-cafe-000000000004');

function getAsync(params) {
  return new Promise((resolve, reject) => {
    const table = params.TableName;
    const identityId = params.Key.identityId;

    // TODO: Handle other possible Dynamo tables we might have
    if (table === process.env.DYNAMO_USER_PROFILE) {

      let profile;

      // check if dynamicly living profile is requested
      if (identityId === 'eu-west-1:00000000-cafe-cafe-cafe-000000000004') {
        profile = cafecafe4profile;
      } else {
        profile = mockProfiles.find(item => item.identityId === identityId);
      }

      // Handle Dynamo's way of strange way of returning an empty object in case of miss.
      if (!profile) {
        return resolve({});
      }

      return resolve({
        Item: Object.assign({}, profile),
      });
    }

    return reject('Mock data not available for ' + table);
  });
}

function putAsync(params) {
  return Promise.resolve({});
}

function updateAsync(params) {
  // mock setting new balance if a dynamic user in case
  if (params && params.Key && params.Key.identityId === 'eu-west-1:00000000-cafe-cafe-cafe-000000000004') {
    if (params.UpdateExpression === 'SET balance=:balance' && !!params.ExpressionAttributeValues[':balance']) {
      cafecafe4profile.balance = params.ExpressionAttributeValues[':balance'];
    }
    const reply = JSON.parse(JSON.stringify(mockUpdateResponse));
    reply.Attributes = cafecafe4profile;
    return Promise.resolve(reply);
  }
  return Promise.resolve(Object.assign({}, mockUpdateResponse));
}

function queryAsync(params) {
  return Promise.resolve({});
}

module.exports = {
  getAsync: getAsync,
  putAsync: putAsync,
  updateAsync: updateAsync,
  queryAsync: queryAsync,
};
