// Require dependency
var Promise = require('bluebird');

// Data
var data = require('./data');

// Export response
module.exports.respond = function (event, callback) {
  callback(null, data);
};
