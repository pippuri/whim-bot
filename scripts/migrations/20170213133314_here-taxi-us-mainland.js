'use strict';

const initDataset = require('./20170213133314_here-taxi-us-mainland/here-taxi-us.json');

exports.up = function (knex, Promise) {
  return knex.insert(initDataset).into('RoutesProvider');
};

exports.down = function (knex, Promise) {
  return knex.raw('DELETE FROM "RoutesProvider" WHERE gid=21');
};
