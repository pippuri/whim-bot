'use strict';

const Model = require('objection').Model;

class TransactionLog extends Model {

  static get tableName() {
    return 'TransactionLog';
  }

  static get idColumn() {
    return 'id';
  }

  $formatDatabaseJson(_json) {
    const json = super.$formatDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    if (_json.created) {
      json.created = new Date(_json.created).toISOString();
    }

    return json;
  }

  $parseDatabaseJson(_json) {
    const json = super.$parseDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    json.created = new Date(_json.created).valueOf();

    return json;
  }
}

module.exports = TransactionLog;
