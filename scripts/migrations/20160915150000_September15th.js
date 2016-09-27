'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
  .raw('CREATE EXTENSION postgis;')
  .raw(`
    CREATE TABLE "Provider" (
    gid serial NOT NULL,
    "providerName" character varying(240) NOT NULL,
    "providerType" character varying(240) NOT NULL,
    "agencyId" character varying(240) NOT NULL,
    "providerPrio" integer,
    "providerMeta" jsonb,
    the_geom geometry,
    CONSTRAINT Provider_pkey PRIMARY KEY (gid),
    CONSTRAINT enforce_dims_geom CHECK (st_ndims(the_geom) = 2),
    CONSTRAINT enforce_geotype_geom CHECK (geometrytype(the_geom) = 'POLYGON'::text OR the_geom IS NULL) )
    WITH ( OIDS=FALSE );`)
    .raw('CREATE INDEX IF NOT EXISTS Provider_geom_gist ON "Provider" USING gist (the_geom);');
};

exports.down = function (knex, Promise) {
  return knex.schema
  .raw('DROP INDEX IF EXISTS "Provider_geom_gist"')
  .raw('DROP EXTENSION IF EXISTS "postgis"');
};
