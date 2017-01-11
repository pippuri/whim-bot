'use strict';


exports.up = function (knex) {
  return knex.schema
    .table('TransactionLog', table => {
      table.dropColumn('modified');
    })
    .raw(`
      CREATE OR REPLACE FUNCTION proc_prevent_update()
      RETURNS trigger AS
      $$
        BEGIN
          RETURN OLD;
        END;
      $$ LANGUAGE plpgsql;
    `)
    .raw(`
      CREATE TRIGGER "trig_prevent_update" BEFORE UPDATE
      ON "TransactionLog"
      FOR EACH ROW EXECUTE PROCEDURE proc_prevent_update();
    `);
};


exports.down = function (knex) {
  return knex.schema
    .raw('DROP TRIGGER IF EXISTS "trig_prevent_update" ON "TransactionLog";')
    .raw('DROP FUNCTION IF EXISTS "proc_prevent_update"();')
    .table('TransactionLog', table => {
      table.timestamp('modified');
    });
};
