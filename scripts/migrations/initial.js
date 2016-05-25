exports.up = function (knex) {
  return knex.schema
    .createTable('Itinerary', function (table) {
      table.bigincrements('id').primary();
      table.string('identityId');

      // OTP specific
      table.timestamp('startTime');
      table.timestamp('endTime');
      table.jsonb('fare');

      // Augmented version
      table.string('signature');
    })
    .createTable('Leg', function (table) {
      table.bigincrements('id').primary();
      table.bigInteger('itineraryId').references('Itinerary.id');

      // OTP specific
      table.jsonb('from');
      table.jsonb('to');
      table.timestamp('startTime');
      table.timestamp('endTime');
      table.string('mode');
      table.integer('departureDelay');
      table.integer('arrivalDelay');
      table.decimal('distance');
      table.jsonb('fare');
      table.string('route');
      table.string('routeShortName');
      table.string('routeLongName');
      table.string('agencyId');
      table.jsonb('legGeometry');

      // Augmented version
      table.string('signature');
    })
    .createTable('Booking', function (table) {
      table.bigincrements('id').primary();
      table.bigInteger('legId').references('Leg.id');

      table.string('signature');
      table.string('state');
      table.jsonb('token');
      table.jsonb('meta');
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('Itinerary')
    .dropTableIfExists('Leg')
    .dropTableIfExists('Booking');
};
