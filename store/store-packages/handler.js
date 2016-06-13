'use strict';

// Require logic
var lib = require('./index');

// Lamba handler
module.exports.handler = function (event, context) {

  lib.respond(event, function (error, response) {
    return context.done(error, response);
  });
};
