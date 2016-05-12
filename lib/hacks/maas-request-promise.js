var Promise = require('bluebird');
var http = require('http');
var https = require('https');
var urlParser = require('url');
var querystring = require('querystring');
var StreamReader = require('./StreamReader');

// This module is a lightweight polyfill for request-promise which had problems
// with ES6 anyway.
// https://github.com/request/request-promise/issues/93

function chooseTransport(protocol) {
  switch (protocol) {
    case 'http:':
      return http;
    case 'https:':
      return https;
    default:
      throw new Error('New Error: Invalid protocol ' + protocol);
  }
}

function handleResponse(res, opts) {
  var status = res.statusCode;

  // Read the whole body
  var reader = new StreamReader(res);

  return reader.readAll(res)
    .then((body) => {
      // Interpret the status
      if (status >= 200 && status < 300) {
        return Promise.resolve({ response: res, body: body });
      }

      if (status <= 300 && status < 400) {
        return Promise.reject(new Error('Redirects not supported, got ' + status));
      }

      return Promise.reject(new Error('Error in response ' + status));
    });
}

function encodeQuery(map, useQueryString) {
  if (!map) {
    return null;
  }

  if (useQueryString) {
    return querystring.stringify(map);
  }

  var tokens = (Object.keys(map)).map((key) => {
    var unparsedValues = map[key];
    var values;

    if (!unparsedValues) {
      // TODO Check this - can we send keys that have values? request module thinks 'no'
      //return key;
      return '';
    } else if (Array.isArray(unparsedValues)) {
      values = unparsedValues.map(encodeURIComponent);
    } else {
      values = [encodeURIComponent(unparsedValues)];
    }

    var value = values.join(',');
    return [encodeURIComponent(key), value].join('=');
  });

  return tokens.join('&');
}

function handleRequest(method, url, opts) {
  return new Promise((resolve, reject) => {
    // Handle defaults
    url = url || opts.url;
    opts = opts || {};
    opts.headers = opts.headers || {};

    // Reject on some functions we don't have a polyfill for
    if (opts.form) {
      reject(new Error('Form sending not supported yet.'));
    }

    // Parse the URI & headers. Re-parsing is needed to get the formatting changes
    var parsed = urlParser.parse(url);
    parsed.search = encodeQuery(opts.qs, opts.useQuerystring) || parsed.search;
    parsed = urlParser.parse(urlParser.format(parsed));

    // Form options for the request
    var options = {
      method: method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      headers: opts.headers,
    };

    // Handle some known cases
    if (opts.json) {
      options.headers.Accept = 'application/json';
    }

    // Choose the transport
    var transport = chooseTransport(parsed.protocol);

    // Process the request
    var req = transport.request(options, (res) => {
      handleResponse(res, opts)
        .then((packet) => resolve(packet))
        .catch((error) => reject(error));
    });
    req.end();
  })
  .then((packet) => {
    var body = packet.body;
    var response = packet.response;

    // TODO Handle encoding

    // Handle the few known special cases
    if (opts.json) {
      body = JSON.parse(body.toString());
    }

    if (opts.resolveWithFullResponse) {
      response.body = body;
      return Promise.resolve(response);
    }

    return Promise.resolve(body);
  });
}

module.exports = {
  get: handleRequest.bind(null, 'GET'),
  put: handleRequest.bind(null, 'PUT'),
  post: handleRequest.bind(null, 'POST'),
  devare: handleRequest.bind(null, 'DELETE'),
};
