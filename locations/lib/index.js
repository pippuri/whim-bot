'use strict';

/**
 * Lib
 */

module.exports.respond = function (event, cb) {

  const response = {
    message: 'Your Serverless function ran successfully!',
  };

  return cb(null, response);
};
