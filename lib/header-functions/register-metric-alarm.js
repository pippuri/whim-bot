'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');

const REGION = 'eu-west-1';

const CloudWatch = new AWS.CloudWatch({ region: REGION });
const CloudWatchLogs = new AWS.CloudWatchLogs({ region: REGION });

Promise.promisifyAll(CloudWatch);
Promise.promisifyAll(CloudWatchLogs);

const FILTER_NAMESPACE = 'LogMetrics';


function createMetricFilter(metricName, filterName, filterPattern, logGroupName) {
  const params = {
    filterName: filterName,
    filterPattern: filterPattern,
    logGroupName: logGroupName,
    metricTransformations: [
      {
        metricName: metricName,
        metricNamespace: FILTER_NAMESPACE,
        metricValue: '1',
        defaultValue: 0.0,
      },
    ],
  };

  return CloudWatchLogs.putMetricFilterAsync(params)
    .then(data => console.log(`Successfully put metric filter for ${logGroupName}`))
    .catch(error => console.log(`Failed to put metric filter for ${logGroupName}`));
}

/*
function removeMetricFilter(filterName, logGroupName) {
  const params = {
    filterName: filterName,
    logGroupName: logGroupName,
  };

  CloudWatchLogs.deleteMetricFilterAsync(params)
    .then(data => console.log(`Successfully deleted metric filter for ${logGroupName}`))
    .catch(error => console.log(`Failed to deleted metric filter for ${logGroupName}`));
}
*/

function createMetricAlarm(alarmName, metricName, periodSecs, snsArn) {
  const params = {
    AlarmName: alarmName,
    MetricName: metricName,
    Namespace: FILTER_NAMESPACE,
    ComparisonOperator: 'GreaterThanThreshold',
    Threshold: 0.0,
    Statistic: 'Sum',
    EvaluationPeriods: 1,
    Period: periodSecs,
    ActionsEnabled: true,
    InsufficientDataActions: [],
    OKActions: [],
    AlarmActions: [
      snsArn,
    ],
  };

  CloudWatch.putMetricAlarmAsync(params)
    .then(data => console.log(`Successfully put metric alarm ${alarmName}`))
    .catch(error => console.log(`Failed to put metric alarm ${alarmName}`));
}

/*
function deleteMetricAlarm(alarmName) {
  const params = {
    AlarmNames: [
      alarmName,
    ],
  };

  CloudWatch.deleteAlarmsAsync(params)
    .then(data => console.log(`Successfully deleted metric alarm ${alarmName}`))
    .catch(error => console.log(`Failed to deleted metric alarm ${alarmName}`));
}
*/


module.exports = function () {
  if (arguments.length < 3) {
    console.error(`Not enough arguments for header function: ${arguments.length}. Skipping.`);
    return Promise.resolve();
  }

  const slsContext = arguments[arguments.length - 1];
  const periodSecs = arguments[0];
  const snsArn = arguments[1];

  let functionQueue = [];

  if (slsContext.data && slsContext.data.deployed) { // This helps `sls function deploy -a`trigger the script
    functionQueue = functionQueue.concat(slsContext.data.deployed[REGION].map(item => item.functionName));
  } else if (slsContext.options.names && slsContext.options.names.length === 0) {
    functionQueue = functionQueue.concat(slsContext.options.names);
  }

  return Promise.all(functionQueue.map(name => {
    const logGroupName = `/aws/lambda/MaaS-${name}`;
    const filterPattern = `[${slsContext.options.stage}] WARN`;
    const filterName = `Lambda-${slsContext.options.stage}-${name}-errors-metric-filter`;
    const metricName = `Lambda-${slsContext.options.stage}-${name}-errors-metric`;
    const alarmName = `Lambda-${slsContext.options.stage}-${name}-errors-metric-alarm`;

    return createMetricFilter(metricName, filterName, filterPattern, logGroupName)
      .delay(2000)
      .then(() => createMetricAlarm(alarmName, metricName, periodSecs, snsArn));
  }));
};