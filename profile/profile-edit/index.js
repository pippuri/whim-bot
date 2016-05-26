const Promise = require('bluebird');
const lib = require('../../lib/profile/index');
const bus = require('../../lib/service-bus/index');

function updateUserData(event) {
  const table = process.env.DYNAMO_USER_PROFILE;
  const identityId = event.identityId;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new Error('Input missing'));
  }

  if (typeof identityId !== 'string') {
    return Promise.reject(new Error('Invalid or missing identityId'));
  }

  return lib.documentExist(table, 'identityId', identityId, null, null)
    .then(response => {
      if (response !== true) {
        return Promise.reject(new Error(`User ${identityId} does not exist`));        
      }

      const keys = Object.keys(event.payload);
      const expressions = keys.map(key => `${key}=:${key}`);
      const values = {};

      keys.forEach(key => values[':' + key] = event.payload[key]);
      
      const params = {
        TableName: table,
        Key: {
          identityId: event.identityId,
        },
        UpdateExpression: 'SET ' + expressions.join(', '),
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
        ReturnConsumedCapacity: 'INDEXES',
      };

      return docClient.updateAsync(params);
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return updateUserData(event)
    .then((response) => {
      callback(null, response.Attributes);
    })
    .catch((error) => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
