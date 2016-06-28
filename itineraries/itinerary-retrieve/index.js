'use strict';

const Promise = require('bluebird');
const MaasError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils/index');
const moment = require('moment');
const models = require('../../lib/models/index');

// Require postgres, so that it will be bundled
// eslint-disable-next-line no-unused-vars
const pg = require('pg');

// Knex variable, referred to from within functions
let knex;

/**
* Return past itineraries from the full set
*/

function filterPastRoutes(itineraries) {
  const pastRoutes = itineraries.filter(itinerary => {
    return moment(itinerary.startTime) < moment();
  });

  return pastRoutes;
}

/**
* Return future itineraries from the full set
*/

function filterFutureRoutes(itineraries) {
  const futureRoutes = itineraries.filter(itinerary => {
    return moment(itinerary.startTime) > moment();
  });

  return futureRoutes;
}

/**
* Recover leg data from itinerary info
*/
function recoverLegFromItinerary(itinerary) {
  return knex.from('Leg')
   .select('*')
   .where('itineraryId', itinerary.id)
   .then(legs => {
     itinerary.legs = legs;
     itinerary.startTime = new Date(itinerary.startTime).valueOf();
     itinerary.endTime = new Date(itinerary.endTime).valueOf();
     itinerary.signature = utils.sign(itinerary, process.env.MAAS_SIGNING_SECRET);
     legs.map(leg => {
       leg.startTime = new Date(leg.startTime).valueOf();
       leg.endTime = new Date(leg.endTime).valueOf();
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

 // Query for all itinerary of an identityId
  const withoutItineraryId = knex.select().from('Itinerary')
   .where('identityId', event.identityId);

 // Query for an itinerary with an itineraryId for an identityId
  const withItineraryId = knex.select().from('Itinerary')
   .where('identityId', event.identityId)
   .andWhere('id', event.itineraryId);

  const resolve = (event.itineraryId === '') ? withoutItineraryId : withItineraryId;

  return resolve.then(itineraries => {
    const promiseQueue = [];
    output = Object.assign([], itineraries);
    output.map(itinerary => {
      promiseQueue.push(recoverLegFromItinerary(itinerary));
    });

    return Promise.all(promiseQueue);
  })
   .then(response => {
     // Filter itineraries (Optional)
     if (event.filter) {
       switch (event.filter.toLowerCase()) {
         case 'past':
           output = filterPastRoutes(output);
           break;
         case 'future':
           output = filterFutureRoutes(output);
           break;
         default:
           break;
       }
     }
     return {
       itineraries: output,
     };
   });

}

module.exports.respond = (event, callback) => {

  return models.init()
    .then(_knex => {
      knex = _knex;
      return retrieveItinerary(event);
    })
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      callback(error);
    })
    .finally(() => {
     // Close all db connections
      if (knex) {
        knex.destroy();
      }
    });
};
