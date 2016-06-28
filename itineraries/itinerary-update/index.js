'use strict';
const Promise = require('bluebird');
const lib = require('../lib/index');
const knex = lib.initKnex();
const MaasError = require('../../lib/errors/MaaSError');
const _ = require('lodash');

function updateItinerary() {
  const allowedFields = [];

  if (!event.hasOwnProperty('identityId') || event.identityId !== '') {

  }

  if (!event.hasOwnProperty('payload') || Object.keys('payload').length !== ) {

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
