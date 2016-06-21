'use strict';

const AWS = require('aws-sdk');
const Promise = require('bluebird');
const lib = require('../../lib/utilities/index');
const moment = require('moment');

const docClient = new AWS.DynamoDB.DocumentClient();

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
    .then(response => {
      if (response === false) { // True if existed
        return Promise.reject(new Error('User not existed'));
      }

      const item = {
        identityId: event.identityId,
        timeEpoch: moment().unix(),
        transactionId: event.payload.transactionId,
      };
      const params = {
        TableName: process.env.DYNAMO_USER_ROUTE_HISTORY,
        Item: item,
        ReturnValues: 'ALL_NEW',
        ReturnConsumedCapacity: 'TOTAL',
      };
      return docClient.putAsync(params);
    });
}

module.exports.respond = function (event, callback) {
  return saveTransaction(event)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
