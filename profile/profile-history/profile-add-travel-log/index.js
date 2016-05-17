var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../../lib/adapter');
var moment = require('moment');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Save route and time start of route onto DyanomoDB
 */
function saveRoute(event) {
  if (typeof event.payload.route === typeof undefined) {
    return Promise.reject(new Error('No input route'));
  } else if (event.hasOwnProperty('userId')) {
    return Promise.reject(new Error('Missing userId'));
  }

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'userId', event.userId, null, null)
    .then((response) => {
      if (response === false) { // False if existed
        var item = {
          userId: event.userId,
          timeEpoch: moment().unix(),
          route: event.payload.route,
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
  return saveRoute(event)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      callback(error);
    });
};
