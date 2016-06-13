'use strict';

const URL = require('url');
const Templates = (new (require('serverless'))()).classes.Templates;

function loadEnvironment() {
  var values;
  try {
    values = require('../_meta/variables/s-variables-dev.json');
  } catch (e) {
    console.log('Failed to read _meta/variables/s-variables-dev.json');
  }

  const variables = (new Templates(values, '../s-templates.json')).toObject();
  for (var key of Object.keys(variables)) {
    process.env[key] = variables[key];
  }
}

loadEnvironment();

const connection = URL.format({
  protocol: 'postgres:',
  slashes: true,
  hostname: process.env.MAAS_PGHOST,
  port: process.env.MAAS_PGPORT,
  auth: process.env.MAAS_PGUSER + ':' + process.env.MAAS_PGPASSWORD,
  pathname: '/' + process.env.MAAS_PGDATABASE,
});

module.exports = {
  development: {
    client: 'postgresql',
    connection: connection,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },
};
