exports.up = function (knex) {
  return knex.schema
    .createTable('Itinerary', function (table) {
      table.uuid('id').primary();
      table.string('identityId');

      // OTP specific
      table.timestamp('startTime');
      table.timestamp('endTime');
      table.jsonb('fare');
    })
    .createTable('Booking', function (table) {
      table.uuid('id').primary();

      // TODO Find alter tabel syntax where to create the leg reference
      //table.uuid('legId').references('Leg.id');

      table.string('state');
      table.jsonb('leg');
      table.jsonb('customer');
      table.jsonb('token');
      table.jsonb('terms');
      table.jsonb('meta');
    })
    .createTable('Leg', function (table) {
      table.uuid('id').primary();
      table.uuid('itineraryId').references('Itinerary.id');
      table.uuid('bookingId').references('Booking.id');

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
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('Itinerary')
    .dropTableIfExists('Leg')
    .dropTableIfExists('Booking');
};
