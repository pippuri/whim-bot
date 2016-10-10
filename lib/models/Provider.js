'use strict';

module.exports = function (Model) {
  /**
   * This is a work in progress class for managing provider lookups
   * TODO: format JSON as per Objection.js conentions
   */

  return class Provider extends Model {

    static get tableName() { return 'Provider'; }

  };
};
