'use strict';

exports.up = function (knex) {
  return knex.schema
  // RoutesProvider table
  .raw(`
    CREATE TABLE "RoutesProvider" (
    "gid" serial NOT NULL,

    "providerPrio" integer NOT NULL,
    "active" boolean NOT NULL,
    "providerName" varchar(50) NOT NULL,
    "providerType" varchar(50) NOT NULL,
    "agencyId" varchar(50) NOT NULL,
    "modes" varchar(15)[] NOT NULL,

    "options" jsonb NOT NULL,
    "capabilities" jsonb NOT NULL,

    the_geom geometry NOT NULL,

    CONSTRAINT RoutesProvider_pkey PRIMARY KEY (gid),
    CONSTRAINT enforce_dims_geom CHECK (st_ndims(the_geom) = 2),
    CONSTRAINT enforce_geotype_geom CHECK (geometrytype(the_geom) = 'POLYGON'::text OR the_geom IS NULL) )
    WITH ( OIDS=FALSE );`)
  // BookingProvider table
  .raw(`
    CREATE TABLE "BookingProvider" (
    "gid" serial NOT NULL,

    "providerPrio" integer NOT NULL,
    "active" boolean NOT NULL,
    "providerName" varchar(50) NOT NULL,
    "providerType" varchar(50) NOT NULL,
    "agencyId" varchar(50) NOT NULL,
    "modes" varchar(15)[] NOT NULL,

    "type" varchar(20) NOT NULL,
    "value" integer NOT NULL DEFAULT 0,
    "baseValue" integer NOT NULL DEFAULT 0,
    "validFor" integer,
    "payableUntil" integer,
    "bookableUntil" integer,

    the_geom geometry,

    CONSTRAINT BookingProvider_pkey PRIMARY KEY (gid),
    CONSTRAINT enforce_dims_geom CHECK (st_ndims(the_geom) = 2),
    CONSTRAINT enforce_geotype_geom CHECK (geometrytype(the_geom) = 'POLYGON'::text OR the_geom IS NULL) )
    WITH ( OIDS=FALSE );`);
};

exports.down = function (knex) {
  return knex.schema
  .dropTableIfExists('BookingProvider')
  .dropTableIfExists('RoutesProvider');
};
