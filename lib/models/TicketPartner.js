'use strict';

const Model = require('objection').Model;

class TicketPartner extends Model {
  static get tableName() {
    return 'TicketPartner';
  }
}

module.exports = TicketPartner;
