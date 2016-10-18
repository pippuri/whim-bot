'use strict';

/**
 * A base error class which can wrap another Error instance.
 * It is then possible to trace a whole chain of errors.
 */
class BaseError extends Error {
  constructor(msg, error) {
    super(msg);
    if (error instanceof Error) {
      this._wrapped = error;
    }
  }

  get wrapped() {
    return this._wrapped;
  }

  getStackTrace() {
    let ret = this.stack;
    if (this._wrapped) {
      ret += '\n⤷ ';
      if (this._wrapped instanceof BaseError) {
        ret += this._wrapped.getStackTrace();
      } else {
        ret += this._wrapped.stack;
      }
    }
    return ret;
  }

  getMessageTrace() {
    let ret = this.message;
    if (this._wrapped) {
      ret += '\n⤷ ';
      if (this._wrapped instanceof BaseError) {
        ret += this._wrapped.getMessageTrace();
      } else {
        ret += this._wrapped.message;
      }
    }
    return ret;
  }
}


module.exports = BaseError;
