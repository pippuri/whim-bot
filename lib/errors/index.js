'use strict';

const BaseError = require('./BaseError');
const MaaSError = require('./MaaSError');
const ValidationError = require('../validator/ValidationError');


const ALWAYS_SUCCEED = true;
const CAN_FAIL = false;

const DEFAULT_DEFAULT_ERROR_CODE = 500;
const DEFAULT_DEFAULT_ERROR_MESSAGE = 'Internal server error';

//------------------------------------------------------------------------
// Convert the received error into the appropriate MaaSError
function _get_maas_error(error, defaultErrorMessage, defaultErrorCode) {
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
      return new MaaSError('Could not handle error response', 500, ex);
    }
  }

  // Anything else is the given default
  defaultErrorMessage = defaultErrorMessage || DEFAULT_DEFAULT_ERROR_MESSAGE;
  defaultErrorCode = defaultErrorCode || DEFAULT_DEFAULT_ERROR_CODE;
  return new MaaSError(defaultErrorMessage, defaultErrorCode, error);
}

function _handle_error(error, callback, event, defaultErrorMessage, defaultErrorCode, alwaysSucceed) {
  const ret = _get_maas_error(error, defaultErrorMessage, defaultErrorCode);

  //[TODO: here is where you could improve logging]
  console.log(`Caught an error: ${ret.message}`);
  console.log('This event caused error: ' + JSON.stringify(event, null, 2));
  if (ret instanceof BaseError) {
    console.log(ret.getStackTrace());
  } else {
    console.log(ret.stack);
  }

  // Handle the callback, if `alwaysSucceed` is set,
  // treat `defaultErrorMessage` as a success response
  if (alwaysSucceed) {
    callback(null, defaultErrorMessage);
  } else {
    callback(ret);
  }
}

function _errorHandler(callback, event, Database, defaultErrorMessage, defaultErrorCode, alwaysSucceed) {
  return function (error) {
    // If we have been passed a Database object, call cleanup, then handle the error
    if (typeof Database !== typeof undefined) {
      return Database.cleanup()
        .then(_handle_error(error, callback, event, defaultErrorMessage, defaultErrorCode, alwaysSucceed));
    }

    // Otherwise just handle the error
    return _handle_error(error, callback, event, defaultErrorMessage, defaultErrorCode, alwaysSucceed);
  };
}

/**
 * Return a function which can be used as an error handler in a Promise chain
 * A centralized place for this error handling allows for the possibility of
 * more coherent/coordinated/semantic/etc error logging in future.
 */
function stdErrorHandler(callback, event, Database, defaultErrorMessage, defaultErrorCode) {
  return _errorHandler(callback, event, Database, defaultErrorMessage, defaultErrorCode, CAN_FAIL);
}


/**
 * Return a function which can be used as an error handler in a Promise chain
 * A centralized place for this error handling allows for the possibility of
 * more coherent/coordinated/semantic/etc error logging in future.
 */
function alwaysSucceedErrorHandler(callback, event, Database, defaultErrorMessage, defaultErrorCode) {
  return _errorHandler(callback, event, Database, defaultErrorMessage, defaultErrorCode, ALWAYS_SUCCEED);
}

module.exports = {
  stdErrorHandler,
  alwaysSucceedErrorHandler,
  MaaSError,
  BaseError,
};

