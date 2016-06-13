'use strict';

const mockUpdateResponse = require('./mockDynamoUpdateProfile.json');
const mockProfiles = require('./mockDynamoProfiles.json');
const Promise = require('bluebird');

function getAsync(params) {
  return new Promise((resolve, reject) => {
    const table = params.TableName;
    const identityId = params.Key.identityId;

    // TODO: Handle other possible Dynamo tables we might have
    if (table === process.env.DYNAMO_USER_PROFILE) {
      const profile = mockProfiles.find(item => item.identityId === identityId);

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
