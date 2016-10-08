'use strict';

exports.up = function (knex, Promise) {
  return knex.schema.table('Leg', table => {
    table.index(['itineraryId']);
  })
  .table('Itinerary', table => {
    table.index(['identityId', 'state']);
  })
  .table('Booking', table => {
    // For JSON indexes, see https://www.vincit.fi/en/blog/by-the-power-of-json-queries/
    knex.raw('CREATE INDEX ?? on ?? USING GIN (?? jsonb_path_ops)', ['booking_customer_gin', 'Booking', 'customer']);
    knex.raw('CREATE INDEX ?? on ?? USING GIN (?? jsonb_path_ops)', ['booking_leg_gin', 'Booking', 'leg']);
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.table('Leg', table => {
    table.dropIndex(['itineraryId']);
  })
  .table('Itinerary', table => {
    table.dropIndex(['identityId', 'state']);
  })
  .table('Booking', table => {
    // For JSON indexes, see https://www.vincit.fi/en/blog/by-the-power-of-json-queries/
    knex.raw('DROP INDEX ??', ['booking_customer_gin']);
    knex.raw('DROP INDEX ??', ['booking_leg_gin']);
  });
};
