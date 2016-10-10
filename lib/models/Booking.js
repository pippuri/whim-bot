'use strict';

const Model = require('objection').Model;

class Booking extends Model {
  static get tableName() {
    return 'Booking';
  }
}

module.exports = Booking;
