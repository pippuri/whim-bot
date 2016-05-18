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
  if (event.hasOwnProperty('route') && event.route !== '') {
    // No problem
  } else {
    return Promise.reject(new Error('No input route'));
  }

  if (!event.hasOwnProperty('userId') || event.userId === '') {
    return Promise.reject(new Error('Missing userId'));
  }

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'userId', event.userId, null, null)
    .then((response) => {
      if (response === false) { // False if existed
        var item = {
          userId: event.userId,
          timeEpoch: moment().unix(),
          route: event.route,
        };
        var params = {
          TableName: process.env.DYNAMO_USER_TRAVEL_LOG,
          Item: item,
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
