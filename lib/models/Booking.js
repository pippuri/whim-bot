'use strict';

module.exports = function (Model) {

  return class Booking extends Model {
    static get tableName() {
      return 'Booking';
    }
  };

};
