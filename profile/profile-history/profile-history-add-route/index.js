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
  if (event.route === undefined) {
    return Promise.reject(new Error('No input route'));
  }

  return lib.getCognitoDeveloperIdentity(event.countryPhoneCode + event.plainPhone)
    .then((response) => {
      var item = {
        IdentityId: response.identityId,
        TimeEpoch: moment().unix(),
        route: event.route,
      };
      console.log(item);
      var params = {
        TableName: process.env.DYNAMO_USER_ROUTE_HISTORY,
        Item: item,
        ReturnValues: 'ALL_OLD',
        ReturnConsumedCapacity: 'TOTAL',
      };
      return docClient.putAsync(params);
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
