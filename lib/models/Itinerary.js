'use strict';

const Model = require('objection').Model;
const Leg = require('./Leg');

class Itinerary extends Model {
  $formatDatabaseJson(_json) {
    const json = super.$formatDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    if (_json.startTime) {
      json.startTime = new Date(_json.startTime).toISOString();
    }
    if (_json.endTime) {
      json.endTime = new Date(_json.endTime).toISOString();
    }
    if (_json.created) {
      json.created = new Date(_json.created).toISOString();
    }
    if (_json.modified) {
      json.modified = new Date(_json.modified).toISOString();
    }

    return json;
  }

  $parseDatabaseJson(_json) {
    const json = super.$parseDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    json.startTime = new Date(_json.startTime).valueOf();
    json.endTime = new Date(_json.endTime).valueOf();
    json.created = new Date(_json.created).valueOf();
    json.modified = new Date(_json.modified).valueOf();

    return json;
  }

  static get tableName() {
    return 'Itinerary';
  }

  static get relationMappings() {
    return {
      legs: {
        relation: Model.HasManyRelation,
        modelClass: Leg,
        join: {
          from: 'Itinerary.id',
          to: 'Leg.itineraryId',
        },
      },
    };
  }
}

module.exports = Itinerary;
