'use strict';

const Database = require('../models/Database');
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
  constructor() {
    this.id = createId();
    this._meta = {};
  }

  /**
   * Start the transaction by calling objection start
   *
   * @return {Promise -> transaction} transaction - return objection transaction
   */
  start() {
    console.info(`[Transaction start] New transaction id ${this.id}`);
    // return a new objection transaction
    const self = this;
    return objection.transaction.start(Database.knex)
      .then(transaction => (self.transaction = transaction))
      .then(() => Promise.resolve());
  }

  /**
   * Binds a specific model instance to the transaction.
   *
   * @param {class} model - The Objection model to bind into the transaction
   * @return {object} - this transaction (to permit chaining of the calls)
   */
  bind(model) {
    return model.bindTransaction(this.transaction);
  }

  /**
  * Bind arbitrary key-value pair to the transaction
  * @param {String/Number} key
  * @param {Whatever} value
  * @return {Promise -> empty}
  */
  meta(key, value) {

    if (typeof key !== 'string' && isNaN(key)) return Promise.reject(new TypeError('Meta key must be String or Number'));
    if (!value) return Promise.reject(new TypeError('Cannot put falsy meta value'));

    if (!Array.isArray(this._meta[key])) {
      this._meta[key] = [value];
    } else if (!this._meta[key].some(_value => _value === value)) {
      this._meta[key].push(value);
    } else {
      // Do nothing
    }

    return Promise.resolve();
  }

  /**
   * Commits the transaction.
   * This method commits the Objection transaction and writes to the transaction
   * log in the same go.
   * @param {string} message - the human-readable message to write into the log
   * @param {number} value - the value of this transaction in points
   * @return {Promise} resolves to log entry or reject with Knex error
   */
  commit(message, identityId, value) {
    if (typeof identityId !== 'string') throw new TypeError('identityId must be a string');
    if (typeof message !== 'string' || message.length <= 3) throw new TypeError('message must be a string with length bigger than 3');
    if (isNaN(value)) throw new TypeError('value must be a number');

    this.value = value;
    this.message = message;
    this.identityId = identityId;

    console.info(`[Transaction commit] id ${this.id}: (${this.value}p) ${this.message}`);
    return TransactionLog
      .bindTransaction(this.transaction)
      .query()
      .insert({
        id: this.id,
        identityId: this.identityId,
        message: this.message,
        value: this.value,
        meta: this._meta,
      })
      .then(logEntry => {
        return this.transaction.commit()
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
    console.info(`[Transaction rollback] id ${this.id}`);
    if (this.transaction) {
      return this.transaction.rollback();
    }

    return Promise.resolve();
  }

  /**
   * Return the current record that is going to be insert
   * into TransactionLog table
   *
   * @return {Object} record - to be inserted to DB
   */
  get getRecord() {
    return {
      id: this.id,
      identityId: this.identityId,
      value: this.value,
      message: this.message,
    };
  }

  /**
   * Return objection transaction
   *
   * @return {Object} transaction - objection transaction
   */
  get self() { return this.transaction; }
}

module.exports = Transaction;
