// Require dependency

// Data
var data = require('./data');

// Export response
module.exports.respond = function (event, callback) {
  callback(null, data);
};
