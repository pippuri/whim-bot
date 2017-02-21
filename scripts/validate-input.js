'use strict';

const fs = require('fs');
const path = require('path');
const promiseUtils = require('../lib/utils/promise');
const validator = require('../lib/validator');

let input;
let schema;
const inputFile = process.argv[2];
const schemaFile = process.argv[3];
const readFileAsync = promiseUtils.promisify(fs.readFile, fs);

if (typeof inputFile !== 'string') {
  console.error('Error: No input file given');
  process.exit(2);
}

if (typeof schemaFile !== 'string') {
  console.error('Error: No schema file given');
  process.exit(2);
}

readFileAsync(path.resolve(process.cwd(), inputFile))
  .then(data => {
    input = JSON.parse(data.toString());
  })
  .then(() => readFileAsync(path.resolve(process.cwd(), schemaFile)))
  .then(data => {
    schema = JSON.parse(data.toString());
  })
  .then(() => validator.validate(input, schema))
  .then(errors => {
    if (!errors) {
      console.log(inputFile, 'matches', schemaFile);
      return;
    }

    console.warn(inputFile, ' had the following errors:');
    errors.forEach(error => {
      console.warn(JSON.stringify(error, null, 2));
      console.warn(error.message);
    });
  });
