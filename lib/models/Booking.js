'use strict';

const Model = require('objection').Model;

class Booking extends Model {
  static get tableName() {
    return 'Booking';
  }

  $formatDatabaseJson(_json) {
    const json = super.$formatDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    if (_json.created) {
      json.created = new Date(_json.created).toISOString();
    }
    if (_json.modified) {
      json.modified = new Date(_json.modified).toISOString();
    }

    return json;
  }

  $parseDatabaseJson(_json) {
    const json = super.$parseDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    json.created = new Date(_json.created).valueOf();
    json.modified = new Date(_json.modified).valueOf();

    return json;
  }
}

module.exports = Booking;
