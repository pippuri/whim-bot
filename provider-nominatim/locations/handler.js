
// Require Serverless ENV vars
var ServerlessHelpers = require('serverless-helpers-js');
ServerlessHelpers.loadEnv();

// Require Logic
var lib = require('./index.js');

// Lambda Handler
module.exports.handler = function (event, context) {

  lib.respond(event, function (error, response) {
    return context.done(error, response);
  });
};
