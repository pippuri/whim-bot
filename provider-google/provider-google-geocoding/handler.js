'use strict';

/**
 * Serverless Module: Lambda Handler
 * - Your lambda functions should be a thin wrapper around your own separate
 * modules, to keep your code testable, reusable and AWS independent
 * - 'serverless-helpers-js' module is required for Serverless ENV var support.  Hopefully, AWS will add ENV support to Lambda soon :)
 */

// Require Serverless ENV vars
const ServerlessHelpers = require('serverless-helpers-js');
ServerlessHelpers.loadEnv();

// Require Logic
const lib = require('./index');

// Lambda Handler
module.exports.handler = function (event, context) {

  lib.respond(event, (error, response) => {
    return context.done(error, response);
  });
};
