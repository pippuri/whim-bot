'use strict';

module.exports = function (Model) {

  return class TicketAuditLog extends Model {
    static get tableName() {
      return 'TicketAuditLog';
    }
  };

};
