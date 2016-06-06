
var Promise = require('bluebird');
var lib = require('../lib/utilities/index');
var bus = require('../lib/service-bus/index');
var _ = require('lodash');
var aws = require('aws-sdk');
var lambda = new aws.Lambda();
var docClient = new aws.DynamoDB.DocumentClient();

function updateFunctionStatus(functionId, status, FnResponse) {
  if (_.isEmpty(functionId)) {
    return Promise.reject(new Error('Input missing'));
  } else if (functionId === '' ) {
    return Promise.reject(new Error('Missing functionId'));
  }

  return lib.documentExist('MaaS-scheduled-functions-dev', 'functionId', functionId, null, null)
    .then((response) => {
      if (response === true) { // True if existed
        var params = {
          TableName: 'MaaS-scheduled-functions-dev',
          Key: {
            functionId: functionId,
          },
          UpdateExpression: 'SET flag = :s, functionResponse = :FunctionResponse',
          ExpressionAttributeValues: {
            ':s': status,
            ':FunctionResponse': FnResponse,
          },
          ReturnValues: 'UPDATED_NEW',
          ReturnConsumedCapacity: 'INDEXES',
        };

        return bus.call('Dynamo-update', params);
      } else {
        return Promise.reject(new Error('Function Not Existed'));
      }
    });
}

function getScheduledFunction(event) {

  var params = {
    TableName: 'MaaS-scheduled-functions-dev',
    FilterExpression: 'flag = :Flag AND invokeTime <= :nvkTime',
    ExpressionAttributeValues: {
      ':Flag': 'SCHEDULED',
      ':nvkTime': Date.now(),
    },
  };

  return new Promise(function (resolve, reject) {
    docClient.scan(params, function onScan(err, data) {
      if (err) {
        reject(new Error('Unable to query. Error:' + JSON.stringify(err, null, 2)));
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return getScheduledFunction(event)
    .then((response) => {
      response.Items.forEach(function (item) {
        var params = {
          FunctionName: item.functionName,
          Payload: item.parameters,
        };
        updateFunctionStatus(item.functionId, 'STARTED', null);
        lambda.invoke(params, function (err, data) {
          if (err) {
            updateFunctionStatus(item.functionId, 'FAILED', data.Payload);
            callback(err);
          } else {
            if (data.hasOwnProperty('FunctionError')) {
              updateFunctionStatus(item.functionId, 'FAILED', data.Payload);
            } else {
              updateFunctionStatus(item.functionId, 'FINISHED', data.Payload);
              callback(null, JSON.stringify(data, null, 0));
            }
          }
        });
      });
    })
    .catch((error) => {
      callback(error);
    });
};
