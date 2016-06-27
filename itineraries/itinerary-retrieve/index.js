'use strict';

const Promise = require('bluebird');
const MaasError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils/index');
const lib = require('../../bookings/lib/index');
const knex = lib.initKnex();

// Require postgres, so that it will be bundled
// eslint-disable-next-line no-unused-vars
const pg = require('pg');

function retrieveLegFromItinerary(itinerary) {
  return knex.from('Leg')
    .select('*')
    .where('itineraryId', itinerary.id)
    .then(legs => {
      itinerary.legs = legs;
      itinerary.signature = utils.sign(itinerary, process.env.MAAS_SIGNING_SECRET);
      legs.map(leg => {
        leg.signature = utils.sign(leg, process.env.MAAS_SIGNING_SECRET);
      });
    });
}

/**
 * Get itinerary information using input itineraryId
 */
function retrieveItinerary(event) {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaasError('Missing identityId input', 400));
  }

  if (event.itineraryId !== '' && !event.itineraryId.match(/[A-F0-9]{8}(-[A-F0-9]{4}){3}-[A-F0-9]{12}/i)) {
    return Promise.reject(new MaasError('Invalid itineraryId format', 400));
  }

  let output;

  const withoutItineraryId = knex.select().from('Itinerary')
    .where('identityId', event.identityId);

  const withItineraryId = knex.select().from('Itinerary')
    .where('identityId', event.identityId)
    .andWhere('id', event.itineraryId);

  const resolve = (event.itineraryId === '') ? withoutItineraryId : withItineraryId;

  return resolve.then(itineraries => {
    const promiseQueue = [];
    output = Object.assign([], itineraries);
    output.map(itinerary => {
      promiseQueue.push(retrieveLegFromItinerary(itinerary));
    });

    return Promise.all(promiseQueue);
  })
    .then(response => {
      return output;
    });

}

module.exports.respond = (event, callback) => {
  return retrieveItinerary(event)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      callback(error);
    });
};
