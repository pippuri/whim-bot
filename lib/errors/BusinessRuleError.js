'use strict';

const BaseError = require('./BaseError');
const MaaSError = require('./MaaSError');

/**
 * An specialization of BaseError which indicates
 * errors thrown by the business rules engine.
 */
class BusinessRuleError extends BaseError {

  constructor(message, code, rule, error) {
    if (error instanceof MaaSError || error instanceof BusinessRuleError) {
      // If wrapping a MaaSError por BusinessRuleError don't prepend the code
      super(message, error);
    } else {
      // Add the code into the message to trigger API Gateway response
      super(`${code}: ${rule}: ${message}`, error);
    }

    // Save the code anyway
    this.code = code;

    // Save the rule
    this.rule = rule;
  }
}

module.exports = BusinessRuleError;
