'use strict';

const BaseError = require('./BaseError');
const MaaSError = require('./MaaSError');
const ValidationError = require('../validator/ValidationError');


//------------------------------------------------------------------------
// Convert the received error into the appropriate MaaSError
function _get_maas_error(error) {
  // Pass a MaaSError through as is, but wrap it to maintain the stack trace
  if (error instanceof MaaSError) {
    return error;
  }

  // Convert ValidationErrors to a 400
  if (error instanceof ValidationError) {
    return new MaaSError(error.message, 400, error);
  }

  // Request errors may be in JSON form
  if (error.hasOwnProperty('response')) {
    /* eslint-disable max-depth, brace-style */
    try {
      const response = JSON.parse(error.response.toString());
      if (error.hasOwnProperty('statusCode')) {
        if (error.statusCode === 400) {
          return new MaaSError(response.message, error.statusCode, error);
        }
      }
    }
    catch (ex) {
      return new MaaSError('Internal server error', 500, new MaaSError(ex, 500));
    }
  }

  // Anything else is a 500
  return new MaaSError('Internal server error', 500, error);
}

function _handle_error(error, callback, event) {
  const ret = _get_maas_error(error);

  //[TODO: here is where you could improve logging]
  console.log(`Caught an error: ${ret.message}`);
  console.log('This event caused error: ' + JSON.stringify(event, null, 2));
  if (ret instanceof BaseError) {
    console.log(ret.getStackTrace());
  } else {
    console.log(ret.stack);
  }

  callback(ret);
}


/**
 * Return a function which can be used as an error handler in a Promise chain
 * A centralized place for this error handling allows for the possibility of
 * more coherent/coordinated/semantic/etc error logging in future.
 */
function stdErrorHandler(callback, event, Database) {
  return function (error) {
    // If we have been passed a Database object, call cleanup, then handle the error
    if (typeof Database !== typeof undefined) {
      return Database.cleanup()
        .then(_handle_error(error, callback, event));
    }

    // Otherwise just handle the error
    return _handle_error(error, callback, event);
  };
}

module.exports = {
  stdErrorHandler,
  MaaSError,
  BaseError,
};

