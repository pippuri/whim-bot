var Promise = require('bluebird');
var request = require('request');

var getAsync = Promise.promisify(request.get);
var putAsync = Promise.promisify(request.put);
var postAsync = Promise.promisify(request.post);
var deleteAsync = Promise.promisify(request.delete);

// This module should be replaced with standard request-promise one
// https://github.com/request/request-promise/issues/93 has been fixed

module.exports = {

  get: (url, options) => getAsync(url, options).then(response => response.body),
  put: (url, options) => putAsync(url, options).then(response => response.body),
  post: (url, options) => postAsync(url, options).then(response => response.body),
  delete: (url, options) => deleteAsync(url, options).then(response => response.body),

};
