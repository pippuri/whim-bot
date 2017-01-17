'use strict';

const request = require('request-promise-lite');
const zlib = require('zlib');

const SLACK_TOKEN = 'xoxb-55270714182-UY7cMnTgSTucKTnnzOvW4Gcl';
const SLACK_BASEURL = 'https://slack.com/api';

function extractRequestId(log) {
  return log.message.split('\t')[1];
}

function extractData(log) {
  return log.message.split('\t')[2];
}

function readMessage(b64String) {
  const payload = new Buffer(b64String, 'base64');
  return new Promise((resolve, reject) => {
    zlib.gunzip(payload, (error, result) => {
      if (error) {
        return reject(error);
      }

      result = JSON.parse(result.toString('ascii'));
      return resolve(result);
    });
  });
}

function formatMessage(message) {
  const trippleTick = '```';
  const title = '===== *Received new error* =====\n';
  const errorLog = message.logEvents.filter(item => item.message.match(/(Caught an error)/g))[0];
  const eventLog = message.logEvents.filter(item => item.message.match(/(This event caused error:)/g))[0];

  const formattedErrorLog = extractData(errorLog);
  const formattedEventLog = extractData(eventLog).replace('This event caused error:', '');

  const errorTraces = `
    Happened in : ${message.logGroup}
    On stage    : ${formattedErrorLog.split(':')[0].replace('WARN', '')}
    Timestamp   : ${(new Date(message.logEvents[0].timestamp) || Date.now()).toISOString()}
    Request ID  : ${extractRequestId(eventLog)}
    Event log   : ${formattedEventLog.split(' WARN :')[1].replace(/\n/g, '')}
    Error log   : ${formattedErrorLog.split(' WARN :')[1]}`;

  return title + trippleTick + errorTraces + trippleTick;
}

function sendMessage(log) {
  const query = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    json: true,
    form: {
      token: SLACK_TOKEN,
      channel: '#prod-errors-cw',
      text: formatMessage(log),
      username: 'serverless-bot',
    },
  };
  return request.post(SLACK_BASEURL + '/chat.postMessage', query);
}

module.exports.respond = function (event, callback) {
  console.log(event);
  return readMessage(event.awslogs.data)
    .then(log => sendMessage(log))
    .then(response => callback(null, response))
    .catch(error => callback(error));
};
