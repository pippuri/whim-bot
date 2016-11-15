'use strict';

const BaseError = require('./BaseError');

/**
 * An specialization of BaseError which indicates
 * errors thrown by the business rules engine.
 */
class BusinessRuleError extends BaseError {

  constructor(message, code, rule, error) {
    super(`${code}: ${rule}: ${message}`, error);

    // Save the code anyway
    this.code = code;

    // Save the rule
    this.rule = rule;
  }
}

module.exports = BusinessRuleError;
