'use strict';

const MAXIMUM_REPORTED_RESPONSE_LENGTH = 256;

function trim(message) {
  if (message.length <= MAXIMUM_REPORTED_RESPONSE_LENGTH) {
    return message;
  }

  return `${message.substr(0, MAXIMUM_REPORTED_RESPONSE_LENGTH)}...`;
}

class ValidationError extends Error {
  /**
   * Factory to instantiate a ValidationError from AJV validation error array
   *
   * @param {array} errors The AJV validation errors
   * @return {ValidationError} the new error
   */
  static fromValidatorErrors(errors) {
    const messages = errors.map(error => {
      return `'${error.dataPath}' ${trim(error.message)}, got '${JSON.stringify(error.data)}'`;
    });

    if (messages.length > 1) {
      return new ValidationError(`Multiple validation errors: \n${messages.join('\n')}`);
    }

    return new ValidationError(messages.join(''));
  }

  /**
   * Factory to instantiate ValidationERrorr from a raw value
   *
   * @param path the data path of the parameter (use . to denote paths, e.g. .payload)
   * @param value the value to use
   * @param message the description of the validation error
   * @return ValidationError with the given parameters
   */
  static fromValue(path, value, message) {
    const msg = `Validation error: '${path}' ${trim(message)}, got '${JSON.stringify(value)}'`;

    return new ValidationError(msg);
  }
}

module.exports = ValidationError;
