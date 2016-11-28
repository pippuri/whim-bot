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
   * @param {string} identityId - the customer to associate the transaction to
   * @return {Promise} - resolves to this transaction or rejects with Knex error
   */
  constructor(identityId) {

    if (typeof identityId !== 'string') throw new TypeError('identityId must be a string');

    this.id = createId();
    this.identityId = identityId;
    this.associations = {};
  }

  /**
   * Start the transaction by calling objection start
   *
   * @return {Promise -> transaction} transaction - return objection transaction
   */
  start() {
    console.info(`[Transaction start] New transaction for ${this.identityId}`);
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
  * This information is stored to return the associated Persons, bookings
  * etc. when browsing the logs.
  * @param {string / number} id - The model instance id to associate with (Model.id)
  * @return {Promise -> empty}
  */
  associate(model, id) {
    // Ensure the object is an objection class (test prototype, as we are)
    // comparing classes
    // FIXME Figure out why this is not working
    // if (!(model instanceof objection.Model)) {
    //   throw new TypeError('"model" input is not a subclass of objection.Model');
    // }
    const table = model.tableName;

    if (!Array.isArray(this.associations[table])) {
      this.associations[table] = [id];
    } else if (!this.associations[table].some(_id => _id === id)) {
      this.associations[table].push(id);
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
  commit(value, message) {
    if (typeof message !== 'string' || message.length <= 3) throw new TypeError('message must be a string with length bigger than 3');
    if (isNaN(value)) throw new TypeError('value must be a number');

    this.value = value;
    this.message = message;

    console.info(`[Transaction commit] ${this.identityId}: (${this.value}p) ${this.message}`);
    return TransactionLog
      .bindTransaction(this.transaction)
      .query()
      .insert({
        identityId: this.identityId,
        message: this.message,
        value: this.value,
        associations: this.associations,
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
    console.info(`[Transaction rollback] for ${this.identityId}`);
    return this.transaction.rollback();
  }

  /**
   * Return the current record that is going to be insert
   * into TransactionLog table
   *
   * @return {Object} record - to be inserted to DB
   */
  get getRecord() {
    return {
      identityId: this.identityId,
      value: this.value,
      message: this.message,
    };
  }

  get self() {
    return this.transaction;
  }
}

module.exports = Transaction;
