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
    this.identityId = identityId;
    this.id = createId();
    this._meta = {};
    this._value = 0;
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
    console.info(`[Transaction start] New transaction id ${this.id}, isolation level: ${level}`);
    return objection.transaction.start(models.Database.knex)
      .then(transaction => (this.transaction = transaction))
      .then(() => this.transaction.raw(`SET TRANSACTION ISOLATION LEVEL ${level}`))
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
  *
  * FIXME This should not be promiseful - makes its usage incredibly hard.
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
      console.info(`[Transaction commit] id ${this.id}`);
      return this.transaction.commit();
    }

    // If no message, transaction type must exist
    if (!this._type) { return Promise.reject(new Error('Missing transaction type.')); }
    if (typeof message === 'string' && message.length <= 3) throw new TypeError('message must be a string with length bigger than 3');

    this.message = message;

    console.info(`[Transaction commit] id ${this.id}: (${this.value}p) ${this.message}`);
    return TransactionLog
      .bindTransaction(this.transaction)
      .query()
      .insert({
        id: this.id,
        identityId: this.identityId,
        message: this.message,
        value: this._value,
        meta: this._meta,
        // type: this._type,
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
   * Increase or decrease the value of the transaction
   * @param {String} amount - increase or decrease amount
   */
  increaseValue(amount) {
    if (!amount || amount <= 0) {
      throw new Error('Increase amount must be bigger than 0');
    }
    this._value += amount;
  }
  decreaseValue(amount) {
    if (!amount || amount <= 0) {
      throw new Error('Decrease amount must be bigger than 0');
    }
    this._value -= amount;
  }

  /**
   * Set the type of the transaction
   * @param {String} type
   */
  setType(type) {
    const allowedTypes = ['balanceChange', 'balanceSet'];
    if (!allowedTypes.some(item => type === item)) {
      throw new Error('Transaction type must be either "balanceChange" or "balanceSet"');
    }
    this._type = type;
  }

  /**
   * Return objection transaction
   *
   * @return {Object} transaction - objection transaction
   */
  get toDbTransaction() { return this.transaction; }
}

module.exports = Transaction;
