'use strict';


exports.up = function (knex) {
  return knex.schema
    // Trigger for "modified timestamp" on Profile
    .raw(`
      CREATE TRIGGER "trig_update_modified_timestamp" BEFORE UPDATE
      ON "Profile"
      FOR EACH ROW EXECUTE PROCEDURE proc_update_modified_timestamp();
    `);
};

exports.down = function (knex) {
  return knex.schema
    .raw('DROP TRIGGER IF EXISTS "trig_update_modified_timestamp" ON "Profile"');
};
