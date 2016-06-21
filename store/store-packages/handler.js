'use strict';

// Require logic
const lib = require('./index');

// Lamba handler
module.exports.handler = function (event, context) {

  lib.respond(event, (error, response) => {
    return context.done(error, response);
  });
};
