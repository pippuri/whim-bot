'use strict';

const Promise = require('bluebird');
const swaggerJson = require('./maas-api.json');

function derefJsonSchema() {
  return Promise.resolve(swaggerJson);
}

module.exports.respond = function (event, callback) {
  return derefJsonSchema()
    .then(response => {
      callback(null, response);
    })
    .catch(err => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(err);
    });
};
