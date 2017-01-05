'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const REGION = 'eu-west-1';

const CloudWatchLogs = new AWS.CloudWatchLogs({ region: REGION });
const Lambda = new AWS.Lambda({ region: REGION });

const DESTINATION_ARN = 'arn:aws:lambda:eu-west-1:756207178743:function:MaaS-slack-notification-send';
const FILTER_NAME = 'lambda-warning';

Promise.promisifyAll(CloudWatchLogs);
Promise.promisifyAll(Lambda, { suffix: 'Promise' });

function addLogPermission(arn, loggingFunctionName, stage) {
  const params = {
    FunctionName: arn,
    StatementId: loggingFunctionName,
    Action: 'lambda:InvokeFunction',
    Principal: `logs.${REGION}.amazonaws.com`,
    Qualifier: stage,
  };
  console.log(`Adding log permission for ${loggingFunctionName}`);
  return Lambda.addPermissionPromise(params)
    .catch(() => false);  // Fallback if the permision doesn't exist
}

function removeLogPermission(arn, loggingFunctionName, stage) {
  const params = {
    FunctionName: arn,
    StatementId: loggingFunctionName,
    Qualifier: stage,
  };
  console.log(`Removing log permission for ${loggingFunctionName}`);
  return Lambda.removePermissionPromise(params)
    .catch(() => false); // Fallback if the permision doesn't exist
}

function createSubscriptionFilter(destinationArn, filterName, filterPattern, logGroupName) {
  const params = {
    destinationArn: destinationArn, /* required */
    filterName: filterName,
    filterPattern: filterPattern,
    logGroupName: logGroupName,
  };
  console.log(`Putting subscription filter for ${logGroupName} ...`);
  return CloudWatchLogs.putSubscriptionFilterAsync(params)
    .then((error, data) => {
      if (error.message) {
        console.log('Failed to put subscription filter for ' + params.logGroupName);
        return Promise.reject(error);
      }
      console.log(`Successfully put subscription filter for ${params.logGroupName}!`);
      return Promise.resolve(data);
    })
    .catch(error => {
      console.log(error);
      return false;
    });
}

function removeSubscriptionFilter(filterName, logGroupName) {
  const params = {
    filterName: filterName, /* required */
    logGroupName: logGroupName, /* required */
  };
  console.log(`Deleting subscription filter for ${logGroupName} ...`);
  return CloudWatchLogs.deleteSubscriptionFilterAsync(params)
    .then((error, data) => {
      if (error.message) {
        console.log('Failed to delete subscription filter for ' + params.logGroupName);
        return Promise.reject(error);
      }
      console.log(`Successfully delete subscription filter for ${params.logGroupName}!`);
      return Promise.resolve(data);
    })
    .catch(error => {
      console.log(error);
      return false;
    });
}

module.exports = function () {
  const slsContext = arguments[arguments.length - 1];
  const requiredStage = arguments[0]; // The script with be run only on deployment of this stage
  const filterPattern = arguments[1]; // Pattern to get WARN log from all stage export dev

  let functionQueue = [];
  const destinationArn = DESTINATION_ARN;
  const filterName = FILTER_NAME;

  if (slsContext.options.stage !== requiredStage.toLowerCase()) {
    return Promise.resolve(`Skipped registering subscription filter! Will run only on deployment on ${requiredStage} stage`);
  }

  if (slsContext.data && slsContext.data.deployed) { // This helps `sls function deploy -a`trigger the script
    functionQueue = functionQueue.concat(slsContext.data.deployed[REGION].map(item => item.functionName));
  } else if (slsContext.options.names && slsContext.options.names.length === 0) {
    functionQueue = functionQueue.concat(slsContext.options.names);
  }

  return removeLogPermission(destinationArn, 'MaaS-slack-notification-send')
    .delay(2000)
    .then(() => addLogPermission(destinationArn, 'MaaS-slack-notification-send'))
    .delay(2000)
    .then(() => {
      return Promise.all(functionQueue.filter(name => name !== 'slack-notification-send').map(name => {
        const logGroupName = `/aws/lambda/MaaS-${name}`;

        return removeSubscriptionFilter(filterName, logGroupName)
          .delay(2000)
          .then(() => createSubscriptionFilter(destinationArn, filterName, filterPattern, logGroupName));
      }));
    });
};
