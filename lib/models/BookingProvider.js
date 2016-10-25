'use strict';

const Model = require('objection').Model;

class BookingProvider extends Model {
  static get tableName() { return 'BookingProvider'; }
  static get idColumn() { return 'gid'; }
}

module.exports = BookingProvider;
