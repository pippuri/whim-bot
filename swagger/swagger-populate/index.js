'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');
const deref = require('json-schema-deref');
const swaggerJson = require('../swagger-maas-api-json/maas-api.json');

const derefPromise = Promise.promisify(deref);
const writeFileAsync = Promise.promisify(fs.writeFile);

function derefJsonSchema() {
  return derefPromise(swaggerJson)
    .then((fullSchema, error) => {
      if (error !== undefined) {
        return Promise.reject(error);
      }

      return writeFileAsync(path.join(__dirname, '..', 'swagger-maas-api-json/maas-api.json'), JSON.stringify(fullSchema, null, 2));
    })
    .then(writefileError => {
      if (writefileError) {
        return Promise.reject(writefileError);
      }

      return Promise.resolve('Success');
    });
}

module.exports.respond = (event, callback) => {
  return derefJsonSchema()
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      callback(error);
    });
};
