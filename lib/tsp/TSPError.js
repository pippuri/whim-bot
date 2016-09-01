'use strict';

class TSPError extends Error {

  constructor(message, adapter, fileName, lineNumber) {
    super(`${adapter.id}: ${message}`, fileName, lineNumber);
  }
}

module.exports = TSPError;
