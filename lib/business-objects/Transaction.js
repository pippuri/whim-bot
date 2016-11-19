'use strict';

const Database = require('../models/Database');
const TransactionLog = require('../models/TransactionLog');
const objection = require('objection');

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
   * Starts the transaction.
   * The human readable message and the budgetary value (fare in points) are
   * recorded explicitly, as they are frequently needed when processing the
   * logs.
   *
   * @param {string} identityId - the customer to associate the transaction to
   * @param {string} message - the human-readable message to write into the log
   * @param {number} value - the value of this transaction
   * @return {Promise} - resolves to this transaction or rejects with Knex error
   */
  start(identityId, message, value) {
    // Input validation
    if (typeof identityId !== 'string') {
      throw new TypeError('Missing identityId');
    }

    this.identityId = identityId;
    this.message = message || 'Unknown transaction';
    this.value = value || 0;
    this.associations = {};

    console.info(`[Transaction] for ${this.identityId} starting: ${this.message} (${this.value}p)`);

    // Create a new Objection transaction
    const _this = this;
    return objection.transaction.start(Database.knex)
      .then(transaction => (_this.transaction = transaction))
      .then(() => Promise.resolve());
  }

  /**
   * Binds a specific model instance to the transaction.
   * This information is stored to return the associated Persons, bookings
   * etc. when browsing the logs. Usually these objects are Bookings.
   *
   * TODO Permit calling of non-existing id, e.g. bind to transaction before
   * associating. In some cases ids of the objects are not known beforehand
   *
   * @param {any} id - The model instance id to associate with (Model.id)
   * @param {class} clazz - The Objection model to bind into the transaction
   * @return {object} - this transaction (to permit chaining of the calls)
   */
  bind(id, clazz) {
    // Ensure the object is an objection class (test prototype, as we are)
    // comparing classes
    // FIXME For some reaso this fails
    /*if (!(clazz.prototype instanceof objection.Model)) {
      throw new TypeError('clazz is not a subclass of objection.Model');
    }*/

    const table = clazz.tableName;

    // Create the associations as array as we may deal with multiple objects
    // of the same instance.
    const associations = this.associations[table];
    if (!Array.isArray(associations)) {
      this.associations[table] = [id];
    } else {
      this.associations[table].push(id);
    }

    // TODO Check if multiple bindings to the same class works ok
    return clazz.bindTransaction(this.transaction);
  }

  /**
   * Commits the transaction.
   * This method commits the Objection transaction and writes to the transaction
   * log in the same go.
   *
   * @return {Promise} resolves to log entry or reject with Knex error
   */
  commit() {
    console.info(`[Transaction] for ${this.identityId} committing: ${this.message} (${this.value}p)`);

    // Write the transaction log
    let logEntry;
    return TransactionLog
      .bindTransaction(this.transaction)
      .query()
      .insert({
        identityId: this.identityId,
        message: this.message,
        value: this.value,
        associations: this.associations,
      })
      .then(_logEntry => {
        logEntry = _logEntry;
        return this.transaction.commit();
      })
      .then(() => logEntry);
  }

  /**
   * Rolls back the Objection transaction.
   * Nothing is written into the transaction log.
   *
   * @return {Promise} - resolves to undefined or rejects to Knex error
   */
  rollback() {
    console.info(`[Transaction] for ${this.identityId} rolling back: ${this.message} (${this.value}p)`);

    // Rollback the transaction.
    return this.transaction.rollback();
  }
}

module.exports = Transaction;
