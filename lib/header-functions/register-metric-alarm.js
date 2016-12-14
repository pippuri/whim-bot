'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const doT = require('dot');

const REGION = 'eu-west-1';

const CloudWatch= new AWS.CloudWatch({ region: REGION });
const CloudWatchLogs = new AWS.CloudWatchLogs({ region: REGION });

Promise.promisifyAll(CloudWatch);
Promise.promisifyAll(CloudWatchLogs);

const METRIC_FILTER_NAME_TEMPLATE = 'Lambda-{{=it.stage}}-{{=it.name}}-errors-metric-filter'
const METRIC_NAME_TEMPLATE = 'Lambda-{{=it.stage}}-{{=it.name}}-errors-metric'
const METRIC_ALARM_NAME_TEMPLATE = 'Lambda-{{=it.stage}}-{{=it.name}}-errors-metric-alarm'
const FILTER_PATTERN_TEMPLATE = '"[{{=it.stage}}] WARN"';
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

function removeMetricFilter(filterName, logGroupName) {
  const params = {
    filterName: filterName,
    logGroupName: logGroupName,
  };

  CloudWatchLogs.deleteMetricFilterAsync(params)
    .then(data => console.log(`Successfully deleted metric filter for ${logGroupName}`))
    .catch(error => console.log(`Failed to deleted metric filter for ${logGroupName}`));
}

function createMetricAlarm(alarmName, metricName, periodSecs, snsArn) {
  var params = {
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

function deleteMetricAlarm(alarmName) {
  var params = {
    AlarmNames: [
      alarmName,
    ]
  };

  CloudWatch.deleteAlarmsAsync(params)
    .then(data => console.log(`Successfully deleted metric alarm ${alarmName}`))
    .catch(error => console.log(`Failed to deleted metric alarm ${alarmName}`));
}


module.exports = function () {
  if (arguments.length < 3) {
    console.error(`Not enough arguments for header function: ${arguments.length}. Skipping.`);
    return;
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

  const filterPatternTemplate = doT.template(FILTER_PATTERN_TEMPLATE);
  const filterNameTemplate = doT.template(METRIC_FILTER_NAME_TEMPLATE);
  const metricNameTemplate = doT.template(METRIC_NAME_TEMPLATE);
  const metricAlarmNameTemplate = doT.template(METRIC_ALARM_NAME_TEMPLATE);

  return Promise.all(functionQueue.map(name => {
    const logGroupName = `/aws/lambda/MaaS-${name}`;
    const filterPattern = filterPatternTemplate({name: name, stage: slsContext.options.stage});
    const filterName = filterNameTemplate({name: name, stage: slsContext.options.stage});
    const metricName = metricNameTemplate({name: name, stage: slsContext.options.stage});
    const alarmName = metricAlarmNameTemplate({name: name, stage: slsContext.options.stage});

    return createMetricFilter(metricName, filterName, filterPattern, logGroupName)
      .delay(2000)
      .then(() => createMetricAlarm(alarmName, metricName, periodSecs, snsArn));
  }));
};
