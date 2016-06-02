// jshint -W034
// Node needs the declaration to permit usage of 'let' */
'use strict';

class MaaSError extends Error {

  constructor(message, code, fileName, lineNumber) {
    super(code + ': ' + message, fileName, lineNumber);
    this.code = code;
  }
}

module.exports = MaaSError;
