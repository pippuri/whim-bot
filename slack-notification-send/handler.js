'use strict';

// Require Logic
const lib = require('./index');

// Lambda Handler
module.exports.handler = function (event, context) {
  // require('../lib/header-functions/prefix-console-log')();
  lib.respond(event, (error, response) => {
    return context.done(error, response);
  });
};
