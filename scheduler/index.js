
var Promise = require('bluebird');
var lib = require('../lib/utilities/index');
var bus = require('../lib/service-bus/index');
var _ = require('lodash');
var aws = require('aws-sdk');

var docClient = new aws.DynamoDB.DocumentClient();

function updateFunctionStatus(functionId, status, FnResponse) {
  if (_.isEmpty(functionId)) {
    return Promise.reject(new Error('Input missing'));
  } else if (functionId === '' ) {
    return Promise.reject(new Error('Missing functionId'));
  }

  return lib.documentExist(process.env.MAAS_SCHEDULER, 'functionId', functionId, null, null)
    .then(response => {
      if (response === false) { // False means not existed
        return Promise.reject(new Error('Function Not Existed'));
      }

      var params = {
        TableName: process.env.MAAS_SCHEDULER,
        Key: {
          functionId: functionId,
        },
        UpdateExpression: 'SET #flag = :s, #functionResponse = :functionResponse',
        ExpressionAttributeValues: {
          ':s': status,
          ':functionResponse': Object.keys(FnResponse).length === 0 ? 'Error' : FnResponse,
        },
        ExpressionAttributeNames: {
          '#flag': 'flag',
          '#functionResponse': 'functionResponse',
        },
        ReturnValues: 'UPDATED_NEW',
        ReturnConsumedCapacity: 'INDEXES',
      };

      return bus.call('Dynamo-update', params);
    });
}

function getScheduledFunction() {

  var params = {
    TableName: process.env.MAAS_SCHEDULER,

    FilterExpression: 'flag = :Flag AND invokeTime <= :nvkTime',
    ExpressionAttributeValues: {

      ':Flag': 'SCHEDULED',
      ':nvkTime': Date.now(),
    },
  };

  return new Promise(function (resolve, reject) {

    // TODO move this to service-bus
    docClient.scan(params, (err, data) => {
      if (err) {
        reject(new Error('Unable to query. Error:' + JSON.stringify(err, null, 2)));
      }

      resolve(data);
    });
  });
}

function runScheduledFunction(event) {
  return getScheduledFunction()
    .then(response => {
      response.Items.forEach(item => {

        updateFunctionStatus(item.functionId, 'STARTED', response);
        return bus.call(item.functionName, JSON.parse(item.parameters))
          .then(response => {
            return updateFunctionStatus(item.functionId, 'FINISHED', response);
          })
          .catch(error => {
            return updateFunctionStatus(item.functionId, 'FAILED', error);
          });
      });
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return runScheduledFunction(event)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      callback(error);
    });
};
