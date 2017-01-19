'use strict';

const models = require('../models');
const TransactionLog = require('../models/TransactionLog');
const objection = require('objection');
const createId = require('../../lib/utils').createId;

/**
 * MaaS Transaction encapsulates an Objection transaction and internal
 * transaction log. To get the transactions properly logged, one should call
 * the start(), commit() and rollback() methods in this class instead of the
 * Objection class.
 *
 * Note that no explicit getters & setters for identityId, message and value
 * are set - they can be changed safely afterwards.
 *
 * Transaction
 * - Creates the Objection transaction context
 * - For objects bound, saves them into transaction history
 * - Writes the transaction history into log
 *
 * @see https://en.wikipedia.org/wiki/Transaction_processing
 */
class Transaction {

  /**
   * Create a new transaction.
   *
   * @return {Promise} - resolves to this transaction or rejects with Knex error
   */
  constructor(identityId) {
    if (typeof identityId !== 'string') throw new TypeError('identityId must be a string');
    this._identityId = identityId;
    this._id = createId();
    this._meta = {};
    this._value = 0;
    // Default transaction type to BALANCE_CHANGE
    this._type = Transaction.types.BALANCE_CHANGE;
  }

  /**
   * Start the transaction by calling objection start
   *
   * @return {Promise -> transaction} transaction - return objection transaction
   */
  start(level) {
    level = level || 'READ COMMITTED';
    // return a new objection transaction
    switch (level) {
      case 'READ COMMITTED':
      case 'REPEATABLE READ':
      case 'SERIALIZABLE':
        // ok
        break;
      default:
        throw new Error(`Isolation level ${level} unavailable, valid levels are READ COMMITTED/REPEATABLE READ/SERIALIZABLE`);
    }
    console.info(`[Transaction start] New transaction id ${this._id}, isolation level: ${level}`);
    return objection.transaction.start(models.Database.knex)
      .then(transaction => (this._transaction = transaction))
      .then(() => this._transaction.raw(`SET TRANSACTION ISOLATION LEVEL ${level}`))
      .then(() => Promise.resolve());
  }

  /**
   * Binds a specific model instance to the transaction.
   *
   * @param {class} model - The Objection model to bind into the transaction
   * @return {object} - this transaction (to permit chaining of the calls)
   */
  bind(model) {
    return model.bindTransaction(this._transaction);
  }

  /**
  * Bind arbitrary key-value pair to the transaction
  *
  * @param {String/Number} key
  * @param {Whatever} value
  */
  meta(key, value) {
    if (typeof key !== 'string' && isNaN(key)) throw new TypeError('Meta key must be String or Number');
    if (!value) throw new TypeError('Cannot put falsy meta value');

    if (!Array.isArray(this._meta[key])) {
      this._meta[key] = [value];
    } else if (!this._meta[key].some(_value => _value === value)) {
      this._meta[key].push(value);
    } else {
      // Do nothing
    }
  }

  /**
   * Commits the transaction.
   * This method commits the Objection transaction and writes to the transaction
   * log in the same go. If no message is given, do not create transaction log
   * @param {string} message - the human-readable message to write into the log
   * @param {number} value - the value of this transaction in points
   * @return {Promise} resolves to log entry or reject with Knex error
   */
  commit(message) {
    if (!message) {
      console.info(`[Transaction commit] id ${this._id}: no message given, skipping log entry creation`);
      return this._transaction.commit();
    }

    // If there is message, transaction type must exist
    if (typeof message !== 'string' || message.length <= 3) {
      throw new TypeError('Message must be a string with length bigger than 3');
    }

    if (!this._type || !Object.keys(Transaction.types).some(item => this._type === item)) {
      throw new Error('Missing transaction type');
    }

    this._message = message;

    console.info(`[Transaction commit] id ${this._id}: (${this._value}p) ${this._message}`);
    return TransactionLog
      .bindTransaction(this._transaction)
      .query()
      .insert({
        id: this._id,
        identityId: this._identityId,
        message: this._message,
        value: this._value,
        meta: this._meta,
        type: this._type,
      })
      .then(logEntry => {
        return this._transaction.commit()
          .then(() => logEntry);
      });
  }

  /**
   * Rolls back the Objection transaction.
   * Nothing is written into the transaction log.
   *
   * @return {Promise} - resolves to undefined or rejects to Knex error
   */
  rollback() {
    console.info(`[Transaction rollback] id ${this._id}`);
    if (this._transaction) {
      return this._transaction.rollback();
    }

    return Promise.resolve();
  }

  /**
   * Increase or decrease or set the value of the transaction
   * @param {String} amount - increase or decrease amount
   */
  increaseValue(amount) {
    if (typeof amount !== 'boolean' && amount >= 0) {
      this._value += amount;
    } else {
      throw new Error('Decrease amount must be bigger than 0');
    }
  }
  decreaseValue(amount) {
    if (typeof amount !== 'boolean' && amount >= 0) {
      this._value -= amount;
    } else {
      throw new Error('Decrease amount must be bigger than 0');
    }
  }

  set value(amount) {
    if (this._type !== Transaction.types.BALANCE_SET) {
      throw new TypeError('Transaction type must be "BALANCE_SET" to directly set transaction value');
    }
    this._value = amount;
  }

  /**
   * Set the type of the transaction
   * @param {String} type
   */
  set type(type) {
    if (!Object.keys(Transaction.types).some(item => type === item)) {
      throw new Error('Transaction type must be either "BALANCE_CHANGE", "BALANCE_SET" or "BALANCE_SYNC"');
    }
    this._type = type;
  }

  /**
   * Get available transaction types
   * @return {Object} types
   */
  static get types() {
    return {
      BALANCE_CHANGE: 'BALANCE_CHANGE',
      BALANCE_SET: 'BALANCE_SET',
      BALANCE_SYNC: 'BALANCE_SYNC',
    };
  }

  /**
   * Return objection transaction
   *
   * @return {Object} transaction - objection transaction
   */
  get toDbTransaction() { return this._transaction; }
}

module.exports = Transaction;
