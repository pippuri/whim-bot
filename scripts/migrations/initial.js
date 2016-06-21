'use strict';

exports.up = function (knex) {
  return knex.schema
    .createTable('Itinerary', table => {
      table.uuid('id').primary();
      table.string('identityId').index().notNullable();

      // OTP specific
      table.timestamp('startTime').index();
      table.timestamp('endTime');
      table.jsonb('fare');
    })
    .createTable('Booking', table => {
      table.uuid('id').primary();

      // TSP generated foreign key (primary from their viewpoint)
      table.string('tspId').index().notNullable();

      // TODO Find alter tabel syntax where to create the leg reference
      //table.uuid('legId').references('Leg.id');

      table.string('state').notNullable();
      table.jsonb('leg');
      table.jsonb('customer');
      table.jsonb('token');
      table.jsonb('terms');
      table.jsonb('meta');
    })
    .createTable('Leg', table => {
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
    .dropTableIfExists('Leg')
    .dropTableIfExists('Itinerary')
    .dropTableIfExists('Booking');
};
