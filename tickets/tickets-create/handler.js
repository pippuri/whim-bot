'use strict';

// Require Logic
const lib = require('./index');

// Lambda Handler
module.exports.handler = function (event, context, callback) {
  lib.respond(event, (error, response) => {
    return callback(error, response);
  });
};
