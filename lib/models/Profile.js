'use strict';

const Model = require('objection').Model;

class Profile extends Model {

  static get tableName() {
    return 'Profile';
  }

  static get idColumn() {
    return 'identityId';
  }
<<<<<<< 458616ebb8aac56d8875f5f200aa409c0fa43ac2

  $formatDatabaseJson(_json) {
    const json = super.$formatDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
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
    json.created = new Date(_json.created).valueOf();
    json.modified = new Date(_json.modified).valueOf();

    return json;
  }
=======
>>>>>>> Move all profile related business logic into Profile biz object
}

module.exports = Profile;
