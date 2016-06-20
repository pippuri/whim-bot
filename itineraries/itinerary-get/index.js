'use strict';

const URL = require('url');
const Promise = require('bluebird');
const MaasError = require('../../lib/errors/MaaSError');
const knexFactory = require('knex');
const Model = require('objection').Model;

function initKnex() {
  //console.log('Initialize knex');

  // FIXME Change variable names to something that tells about MaaS in general
  const connection = URL.format({
    protocol: 'postgres:',
    slashes: true,
    hostname: process.env.MAAS_PGHOST,
    port: process.env.MAAS_PGPORT,
    auth: process.env.MAAS_PGUSER + ':' + process.env.MAAS_PGPASSWORD,
    pathname: '/' + process.env.MAAS_PGDATABASE,
  });
  const config = {
    client: 'postgresql',
    connection: connection,
  };

  const knex = knexFactory(config);
  Model.knex(knex);

  return knex;
}

const knex = initKnex();

/**
 * Get itinerary information using input itineraryId
 */
function retrieveItinerary(event) {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaasError('Missing identityId input', 400));
  }

  if (!event.hasOwnProperty('itineraryId') || event.itineraryId === '' || !event.itineraryId.match(/[A-F0-9]{8}(-[A-F0-9]{4}){3}-[A-F0-9]{12}/g)) {
    return Promise.reject(new MaasError('Missing or invalid itineraryId', 400));
  }

  let output;

  return knex.select().from('Itinerary')
    .where('id', event.itineraryId)
    .andWhere('identityId', event.identityId)
    .then(itineraries => {
      output = itineraries;
      const promiseQueue = [];
      output.map(itinerary => {
        promiseQueue.push(
          knex.from('Leg').select('*').where('itineraryId', itinerary.id)
            .then(legs => {
              itinerary.legs = legs;
            })
        );

      });
      return Promise.all(promiseQueue);
    })
    .then(response => {
      return output;
    });

}

module.exports.respond = (event, callback) => {
  retrieveItinerary(event)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      callback(error);
    })
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
};
