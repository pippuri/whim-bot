'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(dynamo);

module.exports = dynamo;
