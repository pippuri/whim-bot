'use strict';

// Require Logic
const lib = require('./index');

// Lambda Handler
// NOTE: This uses the callback instead of the normal context.done() because we want to have
// NOTE: the webhook pings executed after returning the ticket, and the node4.3 feature
// NOTE: callbackWaitsForEmptyEventLoop does not seem to be working if you call context.done()
// NOTE: It DOES however work if you use the third callback parameter instead.
module.exports.handler = function (event, context, callback) {
  lib.respond(event, (error, response) => {
    return callback(error, response);
  });
};
