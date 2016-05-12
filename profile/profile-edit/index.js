
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var DOC = require('dynamodb-doc');
var lib = require('../lib/adapter');
var _ = require('lodash');

var dynamo = new AWS.DynamoDB({ region: process.env.AWS_REGION });
var docClient = new DOC.DynamoDB(dynamo);

Promise.promisifyAll(docClient);

/**
 * Check request params validity
 */
function parseOptions(params) {
  var allowedOperation = ['add', 'put', 'delete'];

  if (_.isEmpty(params)) {
    return Promise.reject(new Error('Empty option'));

  } else if (_.isArray(params.operation) || params.operation === undefined || params.operation.length === 0) {
    return Promise.reject(new Error('Invalid or missing operation!'));

  } else if (!_.includes(allowedOperation, params.operation.toLowerCase())) {
    return Promise.reject(new Error('Operation ' + params.operation + ' is invalid'));

  } else if (_.isArray(params.attribute) || params.attribute === undefined || params.attribute.length === 0) {
    return Promise.reject(new Error('Invalid or missing attribute'));

  } else if (params.value.length === 0) {
    return Promise.reject('Invalid or missing attribute value');

  } else {
    return Promise.resolve(params);
  }
}

/**
 * Produce params
 * Default operation is replace
 */
function writeParams(operation, identityId, attribute, value) {
  var updateExpression;
  // Write UpdateExpression
  switch (operation.toLowerCase()) {
    case 'add':
      updateExpression = 'ADD #attr :value';
      break;
    case 'put':
      updateExpression = 'SET #attr = :value';
      break;
    case 'delete':
      updateExpression = 'DELETE #attr : :value';
      break;
  }
  var params = {
    TableName: process.env.DYNAMO_USER_PROFILE,
    Key: {
      IdentityId: identityId,
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: {
      '#attr': attribute,
    },
    ExpressionAttributeValues: {
      ':value': value,
    },
    ReturnValues: 'UPDATED_NEW',
    ReturnConsumedCapacity: 'INDEXES',
  };
  return params;
}

/**
 * Update user datum/data
 * Options * : operation - String - add / delete / put
 * Options * : attribute - String
 * Options   : index = [Int]
 * Options * : data [Obj / String / Int]
 * (*) REQUIRED
 */
function updateUserData(phoneNumber, params) {
  var parsedParams;
  return parseOptions(params)
    .then((response) => {
      parsedParams = response;
      return lib.getCognitoDeveloperIdentity(phoneNumber);
    })
    .then((response) => {
      var params = writeParams(parsedParams.operation, response.identityId, parsedParams.attribute, parsedParams.value);
      return docClient.updateItemAsync(params);
    })
    .then((response) => {
      return response;
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return updateUserData('' + event.phoneCountryCode + event.plainPhone, event.query)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      callback(error);
    });
};
