'use strict';

const URL = require('url');
const Templates = (new (require('serverless'))()).classes.Templates;

/**
 * Note: Run the script like this
 * SERVERLESS_STAGE = ${stage} knex migrate:latest
 */
function loadEnvironment(stage) {
  let values;
  try {
    values = require(`../_meta/variables/s-variables-${stage}.json`);
  } catch (e) {
    console.log(`Failed to read _meta/variables/s-variables-${stage}.json`);
  }

  const variables = (new Templates(values, '../s-templates.json')).toObject();
  for (let key of Object.keys(variables)) { // eslint-disable-line prefer-const
    process.env[key] = variables[key];
  }
}

loadEnvironment(process.env.SERVERLESS_STAGE);

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
