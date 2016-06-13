'use strict';

// Require Logic
var lib = require('./index');

// Lambda Handler
module.exports.handler = function (event, context) {

  lib.respond(event, function (error, response) {
    return context.done(error, response);
  });
};
