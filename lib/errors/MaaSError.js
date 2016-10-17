'use strict';

const BaseError = require('./BaseError');


/**
 * An specialization of BaseError which represents the
 * object returned to the top level in case of an error.
 */
class MaaSError extends BaseError {
  constructor(message, code, error) {
    if (error instanceof MaaSError) {
      // If wrapping a MaaSError don't prepend the code
      super(message, error);
    } else {
      // Add the code into the message to trigger API Gateway response
      super(`${code}: ${message}`, error);
    }

    // Save the code anyway
    this.code = code;
  }
}


module.exports = MaaSError;
