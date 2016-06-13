'use strict';

const validator = require('../lib/validator');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');

let input;
let schema;
const inputFile = process.argv[2];
const schemaFile = process.argv[3];

if (typeof inputFile !== 'string') {
  console.error('Error: No input file given');
  process.exit(2);
}

if (typeof schemaFile !== 'string') {
  console.error('Error: No schema file given');
  process.exit(2);
}

fs.readFileAsync(path.resolve(process.cwd(), inputFile))
  .then((data) => {
    input = JSON.parse(data.toString());
  })
  .then(() => fs.readFileAsync(path.resolve(process.cwd(), schemaFile)))
  .then((data) => {
    schema = JSON.parse(data.toString());
  })
  .then(() => validator.validate(input, schema))
  .then((errors) => {
    if (!errors) {
      console.log(inputFile, 'matches', schemaFile);
      return;
    }

    console.warn(inputFile, ' had the following errors:');
    errors.forEach((error) => {
      console.warn(JSON.stringify(error, null, 2));
      console.warn(error.message);
    });
  });
