'use strict';

exports.up = function (knex, Promise) {
  return knex.raw('UPDATE "RoutesProvider" SET "active"=FALSE WHERE "gid" = ANY(\'{5,6}\'::int[]);');
};

exports.down = function (knex, Promise) {
  return knex.raw('UPDATE "RoutesProvider" SET "active"=TRUE WHERE "gid" = ANY(\'{5,6}\'::int[]);');
};
