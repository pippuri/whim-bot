'use strict';

class BusinessRuleError extends Error {

  constructor(message, rule, fileName, lineNumber) {
    super(`${rule}: ${message}`, fileName, lineNumber);
    this.rule = rule;
  }
}

module.exports = BusinessRuleError;
