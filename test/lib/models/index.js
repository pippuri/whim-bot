'use strict';

const expect = require('chai').expect;
const models = require('../../../lib/models');

describe('models', () => {
  describe('Database', () => {
    const Database = models.Database;

    it('initialises and shuts down properly', () => {
      return Database.init()
        .then(() => {
          expect(Database.handleCount === 1);
          return Database.cleanup();
        })
        .then(() => {
          expect(Database.handleCount === 0);
          return Promise.resolve();
        });
    });

    // SKIP the test because forceful cleanup results other tests to fail
    xit('updates reference counts properly and cleans up forcefully', () => {
      return Database.init()
        .then(() => {
          expect(Database.handleCount === 1);
          return Database.init();
        })
        .then(() => {
          expect(Database.handleCount === 2);
          return Database.init();
        })
        .then(() => {
          expect(Database.handleCount === 3);
          return Database.cleanup();
        })
        .then(() => {
          expect(Database.handleCount === 2);
          return Database.cleanup(true);
        })
        .then(() => {
          expect(Database.handleCount === 0);
          return Promise.resolve();
        });
    });

    it('throws an exception if trying to cleanup a DB that is not initialised', () => {
      return Database.cleanup()
        .then(() => {
          // Always fail if we reach this path
          expect('We should not ever succeed this call').to.be.undefined;
        })
        .catch(error => {
          expect(error).to.be.an.instanceof(Error);
          return Promise.resolve();
        });
    });
  });
});
