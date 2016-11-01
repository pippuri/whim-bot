'use strict';

class BusinessRuleError extends Error {

  constructor(message, code, rule, fileName, lineNumber) {
    super(`${code}: ${rule}: ${message}`, fileName, lineNumber);
    this.code = code;
  }
}

module.exports = BusinessRuleError;
