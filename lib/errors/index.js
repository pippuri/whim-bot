'use strict';

const BaseError = require('./BaseError');
const MaaSError = require('./MaaSError');
const BusinessRuleError = require('./BusinessRuleError');
const ValidationError = require('../validator/ValidationError');
const Database = require('../models/Database');


const ALWAYS_SUCCEED = true;
const CAN_FAIL = false;
const INCLUDE_ERROR_MESSAGE = true;
const EXCLUDE_ERROR_MESSAGE = false;

const MESSAGE_FEILD_NAME = 'message';
const ERROR_MESSAGE_FIELD_NAME = '_error';

const DEFAULT_DEFAULT_ERROR_CODE = 500;
const DEFAULT_DEFAULT_ERROR_MESSAGE = 'Internal server error';

//------------------------------------------------------------------------
// Convert the received error into the appropriate MaaSError
function _get_maas_error(error, defaultErrorMessage, defaultErrorCode) {
  // Pass a MaaSError through as is
  if (error instanceof MaaSError) {
    return error;
  }

  // Convert ValidationErrors to a 400
  if (error instanceof ValidationError) {
    return new MaaSError(error.message, 400, error);
  }

  // Request errors may be in JSON form
  if (error.hasOwnProperty('response')) {
    /* eslint-disable max-depth */
    try {
      if (typeof error.response === typeof '') {
        error.response = JSON.parse(error.response);
      }

      if (error.hasOwnProperty('statusCode')) {
        if (error.statusCode === 400) {
          return new MaaSError(error.response.message, error.statusCode, error);
        }
      }

      if (error.response.hasOwnProperty('http_status_code')) {
        return new MaaSError(error.response.message, error.response.http_status_code, error);
      }
    } catch (ex) {
      return new MaaSError('Could not handle error response', 500, ex);
    }
    /* eslint-enable max-depth */
  }

  // Anything else is the given default
  defaultErrorMessage = defaultErrorMessage || DEFAULT_DEFAULT_ERROR_MESSAGE;
  defaultErrorCode = defaultErrorCode || DEFAULT_DEFAULT_ERROR_CODE;
  return new MaaSError(defaultErrorMessage, defaultErrorCode, error);
}

/**
 * Add the error message into the response. This will always return an object.
 */
function _add_error_to_response(message, error) {
  // First get the actual message
  let errorMessage = null;
  if (error instanceof BaseError) {
    errorMessage = error.getStackTrace();
  } else {
    errorMessage = error.stack;
  }

  let ret = null;
  if (typeof message === typeof {}) {
    // If message is an object, use it as is
    ret = message;
  } else {
    // Ohter wise formulate an object which contains the message
    ret = {};
    ret[MESSAGE_FEILD_NAME] = message;
  }

  // Now that ret is definitely an object, add in the error message
  ret[ERROR_MESSAGE_FIELD_NAME] = errorMessage;
  return ret;
}

function _log_error(error, event) {
  //[TODO: here is where you could improve logging]
  console.warn(`Caught an error: ${error.message}`);
  console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
  if (error instanceof BaseError) {
    console.warn(error.getStackTrace());
  } else {
    console.warn(error.stack);
  }
}

function _handle_error(error, callback, event, defaultErrorMessage, defaultErrorCode, alwaysSucceed, includeErrorMessage) {
  // Extract the error, wrapping in MaaSError if necessary
  const ret = _get_maas_error(error, defaultErrorMessage, defaultErrorCode);

  // Log the error
  _log_error(ret, event);

  // if `alwaysSucceed` is set, treat `defaultErrorMessage` as a success response
  if (alwaysSucceed) {
    if (includeErrorMessage) {
      // If `includeErrorMessage` is set, add in the underlying error to the response
      callback(null, _add_error_to_response(defaultErrorMessage, ret));
    } else {
      callback(null, defaultErrorMessage);
    }
  } else {
    // Error raised in the regular way
    callback(ret);
  }
}

/**
 * Return a function which can be used as an error handler in a Promise chain
 * A centralized place for this error handling allows for the possibility of
 * more coherent/coordinated/semantic/etc error logging in future.
 */
function stdErrorHandler(callback, event, defaultErrorMessage, defaultErrorCode) {
  return function (error) {
    return _handle_error(error, callback, event, defaultErrorMessage, defaultErrorCode, CAN_FAIL, EXCLUDE_ERROR_MESSAGE);
  };
}

/**
 * Return a function which can be used as an error handler in a Promise chain,
 * including database clean up.
 * A centralized place for this error handling allows for the possibility of
 * more coherent/coordinated/semantic/etc error logging in future.
 */
function stdErrorWithDbHandler(callback, event, defaultErrorMessage, defaultErrorCode) {
  return function (error) {
    Database.cleanup();

    return _handle_error(error, callback, event, defaultErrorMessage, defaultErrorCode, CAN_FAIL, EXCLUDE_ERROR_MESSAGE);
  };
}

/**
 * Return a function which can be used as an error handler in a Promise chain
 * A centralized place for this error handling allows for the possibility of
 * more coherent/coordinated/semantic/etc error logging in future.
 */
function alwaysSucceedErrorHandler(callback, event, defaultResponse, defaultResponseCode) {
  return function (error) {
    return _handle_error(error, callback, event, defaultResponse, defaultResponseCode, ALWAYS_SUCCEED, EXCLUDE_ERROR_MESSAGE);
  };
}

/**
 * Return a function which can be used as an error handler in a Promise chain
 * A centralized place for this error handling allows for the possibility of
 * more coherent/coordinated/semantic/etc error logging in future.
 */
function alwaysSucceedIncludeErrorMessageErrorHandler(callback, event, defaultResponse, defaultResponseCode) {
  return function (error) {
    return _handle_error(error, callback, event, defaultResponse, defaultResponseCode, ALWAYS_SUCCEED, INCLUDE_ERROR_MESSAGE);
  };
}

module.exports = {
  stdErrorHandler,
  stdErrorWithDbHandler,
  alwaysSucceedErrorHandler,
  alwaysSucceedIncludeErrorMessageErrorHandler,
  BusinessRuleError,
  MaaSError,
  BaseError,
  messageFieldName: MESSAGE_FEILD_NAME,
  errorMessageFieldName: ERROR_MESSAGE_FIELD_NAME,
};

