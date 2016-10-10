'use strict';

const Model = require('objection').Model;

class TicketAuditLog extends Model {
  static get tableName() {
    return 'TicketAuditLog';
  }
}

module.exports = TicketAuditLog;
