'use strict';

// Require Logic
const lib = require('./index.js');

// Lambda Handler
module.exports.handler = function (event, context) {

  lib.respond(event, function (error, response) {
    return context.done(error, response);
  });
};
