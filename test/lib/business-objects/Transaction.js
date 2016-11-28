'use strict';

const Booking = require('../../../lib/models/Booking');
const Database = require('../../../lib/models/Database');
const expect = require('chai').expect;
const Transaction = require('../../../lib/business-objects/Transaction');
const TransactionLog = require('../../../lib/models/TransactionLog');

const identityId = 'eu-west-1:00000000-dead-dead-eaea-000000000000';
const bookingId = '00000000-dead-dead-eaeae-000000000000';
const message = 'Testing the transaction';
const value = 500;

let transaction;
let logEntry;

before(() => {
  return Database.init();
});

after(() => {

  const promise = Promise.resolve();

  return promise.then(() => TransactionLog.query().deleteById(logEntry.id))
    .then(() => Database.cleanup());
});

describe('Writes the transaction to the DB', () => {
  it(`starts & commits transaction: ${identityId}, ${message}, ${value}`, () => {
    transaction = new Transaction(identityId);
    return transaction.start()
      .then(() => transaction.bind(Booking))
      .then(() => transaction.associate(Booking.tableName, bookingId))
      .then(() => transaction.commit(message, identityId, value))
      .then(_logEntry => (logEntry = _logEntry));
  });

  it('stores the values in the object correctly', () => {
    expect(transaction.getRecord.identityId).to.equal(identityId);
    expect(transaction.getRecord.message).to.equal(message);
    expect(transaction.getRecord.value).to.equal(value);
  });

  it('returns a proper log entry', () => {
    expect(logEntry.id).to.exist;
    expect(logEntry.identityId).to.equal(identityId);
    expect(logEntry.message).to.equal(message);
    expect(logEntry.value).to.equal(value);
  });

  it('writes the values to the database', () => {
    return TransactionLog.query().findById(logEntry.id)
      .then(entry => {
        expect(entry.id).to.exist;
        expect(entry.created).to.exist;
        expect(entry.identityId).to.equal(identityId);
        expect(entry.message).to.equal(message);
        expect(entry.value).to.equal(value);
        expect(entry.associations).to.have.property('Booking');
      });
  });
});
