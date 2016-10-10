'use strict';

const Model = require('objection').Model;

class Provider extends Model {

  static get tableName() { return 'Provider'; }

}

module.exports = Provider;
