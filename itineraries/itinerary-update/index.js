'use strict';

// const Promise = require('bluebird');
// const lib = require('../lib/index');
// const knex = lib.initKnex();
// const MaasError = require('../../lib/errors/MaaSError');
// const _ = require('lodash');

function updateItinerary(event) {
  // const allowedFields = [];

  if (!event.hasOwnProperty('identityId') || event.identityId !== '') {
    return;
  }

  if (!event.hasOwnProperty('payload') || Object.keys('payload').length !== 0) {
    return;
  }
}

module.exports.respond = (event, callback) => {
  updateItinerary(event)
    .then(response => {
      callback(null, response);
    })
    .then(error => {
      callback(error);
    });
};
