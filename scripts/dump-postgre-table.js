'use strict';

const pg = require('pg');
const copyTo = require('pg-copy-streams').to;
const knexFile = require('./knexfile');

function usage() {
  console.log('Usage: node dump-table.js <table> >dump.sql');
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

const stream = client.query(copyTo(`COPY "${table}" TO STDOUT`));
stream.pipe(process.stdout);
stream.on('end', () => {
});
stream.on('error', error => {
  console.error(`Error: ${error.message}`);
});
