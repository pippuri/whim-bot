'use strict';

module.exports = function (Model) {

  return class TicketPartner extends Model {
    static get tableName() {
      return 'TicketPartner';
    }
  };

};
