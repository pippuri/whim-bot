
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../lib/adapter');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Check request params validity
 */
function parseOptions(params) {
  // ADD - add item(s) to list attribute
  // PUT - modify non-list attribute
  // DELETE - remove item(s) from list attribute
  var allowedOperation = ['add', 'put', 'delete'];

  // If options query is empty
  if (_.isEmpty(params)) {
    return Promise.reject(new Error('Empty option!'));
  }

  // If input operation is not String, is not present or is empty
  if (!_.isString(params.operation) || params.operation === undefined || params.operation.length === 0) {
    return Promise.reject(new Error('Invalid or missing operation!'));
  }

  // If input operation is not included in the allowance list
  if (!_.includes(allowedOperation, params.operation.toLowerCase())) {
    return Promise.reject(new Error('Operation ' + params.operation + ' is invalid!'));
  }

  // If input operation is not String, is not present or is empty
  if (!_.isString(params.attribute) || params.attribute === undefined || params.attribute.length === 0) {
    return Promise.reject(new Error('Invalid or missing attribute!'));
  }

  // If value is empty
  if (params.value.length === 0) {
    return Promise.reject('Empty value!');
  }

  if (params.operation === allowedOperation[0] || params.operation === allowedOperation[2]) { // if operation is ADD or DELETE
    if (!_.isArray(params.value)) { // If value is not an array, make it array
      var tmp = [];
      tmp.push(params.value);
      params.value = tmp;
    }
  } else if (params.operation === allowedOperation[1]) { // if operation is PUT
    if (_.isArray(params.value)) { // Error if input value is array
      return Promise.reject(new Error('Operation ' + params.operation.toUpperCase() + ' do not accept multiple values!'));
    }
  }

  return Promise.resolve(params);
}

/**
 * Produce params from input params
 */
function writeParams(input, identityId) {
  var updateExpression;

  // Write UpdateExpression
  switch (input.operation.toLowerCase()) {
    case 'add':
      updateExpression = 'SET #attr = list_append(#attr, :value)';
      break;
    case 'put':
      updateExpression = 'SET #attr = :value';
      break;
    case 'delete':
      updateExpression = 'REMOVE #attr :value'; // TODO Fix this
      break;
  }

  var output = {
    TableName: process.env.DYNAMO_USER_PROFILE,
    Key: {
      IdentityId: identityId,
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: {
      '#attr': input.attribute,
    },
    ExpressionAttributeValues: {
      ':value': input.value,
    },
    ReturnValues: 'UPDATED_NEW',
    ReturnConsumedCapacity: 'INDEXES',
  };
  return output;
}

/**
 * Update user datum/data
 * Options * : operation - String - add / put / delete
 * Options * : attribute - String
 * Options   : index = [Int]
 * Options * : data [Obj / String / Int]
 * (*) REQUIRED
 */
function updateUserData(phoneNumber, options) {
  var parsedParams; // Params parsed from options
  return parseOptions(options)
    .then((response) => {
      parsedParams = response;
      return lib.getCognitoDeveloperIdentity(phoneNumber);
    })
    .then((response) => {
      var queryParams = writeParams(parsedParams, response.identityId); // Params used to query DynamoDB
      return docClient.updateAsync(queryParams);
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return updateUserData(event.phoneCountryCode + event.plainPhone, event.query)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      callback(error);
    });
};
