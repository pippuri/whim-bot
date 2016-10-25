'use strict';

const Model = require('objection').Model;

class RoutesProvider extends Model {
  static get tableName() { return 'RoutesProvider'; }
  static get idColumn() { return 'gid'; }
}

module.exports = RoutesProvider;
