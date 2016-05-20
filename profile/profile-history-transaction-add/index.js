var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../../lib/profile/index');
var moment = require('moment');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Save route and time start of route onto DyanomoDB
 */
function saveTransaction(event) {
  if (event.hasOwnProperty('transactionId') && event.transactionId !== '') {
    // No problem
  } else {
    return Promise.reject(new Error('No input transaction'));
  }

  if (!event.hasOwnProperty('identityId')) {
    return Promise.reject(new Error('Missing identityId'));
  }

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then((response) => {
      if (response === true) { // True if existed
        var item = {
          identityId: event.identityId,
          timeEpoch: moment().unix(),
          transactionId: event.payload.transactionId,
        };
        var params = {
          TableName: process.env.DYNAMO_USER_ROUTE_HISTORY,
          Item: item,
          ReturnValues: 'ALL_NEW',
          ReturnConsumedCapacity: 'TOTAL',
        };
        return docClient.putAsync(params);
      } else if (response === true) {
        return Promise.reject(new Error('User not existed'));
      }
    });
}

module.exports.respond = function (event, callback) {
  return saveTransaction(event)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      callback(error);
    });
};
