'use strict';

const pg = require('pg');
const knexFile = require('./knexfile');

function usage() {
  console.log('Usage: node dump-to-json.js <table> >dump.json');
}

// Read args for parameters
const table = process.argv[2];
const client = new pg.Client(knexFile.development.connection);
client.on('drain', client.end.bind(client)); // disconnect when finished
client.connect();

if (typeof table !== 'string') {
  console.error('Missing argument <table>');
  usage();
  process.exit(1);
}

client.query(`
  select array_to_json(array_agg(row_to_json(t)))
      from (
        select * from "${table}"
      ) t
`, (error, result) => {
  console.log(JSON.stringify(result.rows[0].array_to_json, null, 2));
});
