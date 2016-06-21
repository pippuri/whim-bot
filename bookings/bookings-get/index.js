'use strict';

const Promise = require('bluebird');
const lib = require('../lib/index');
const knex = lib.initKnex();
const request = require('request-promise-lite');

function getBookingInfo(event) {
  if (!event.hasOwnProperty('identityId')) {
    return Promise.reject(new Error('401: Missing identityId'));
  }

  if (!event.hasOwnProperty('payload') || Object.keys('payload').length === 0) {
    return Promise.reject(new Error('400: Missing payload'));
  }

  if (!event.payload.hasOwnProperty('bookingId') || event.payload.bookingId === '') {
    return Promise.reject(new Error('400: Missing bookingId in payload'));
  }

  return Promise.all(
    [
      knex.select('agencyId')
        .from(process.env.MAAS_PGTABLE_LEG)
        .where('bookingId', event.payload.bookingId),
      knex.select('tspId')
        .from(process.env.MAAS_PGTABLE_BOOKING)
        .where('id', event.payload.bookingId),
    ]
  )
  .spread((response1, response2) => {

    const tspId = response1[0].agencyId;
    const tspBookingId = response2[0].tspId;

    return lib.findAgency(tspId)
      .then(tsp => {
        const params = {
          id: tspBookingId,
        };
        const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.retrieve;
        const options = Object.assign({
          json: true,
          body: params,
        }, tsp.adapter.options);

        console.log('url ', url);
        return request.get(url, options); // Delegate booking call to specific TSP api endpoint
      });
  });
}

module.exports.respond = (event, callback) => {
  return getBookingInfo(event)
    .then(response=> {

      // callback(null, JSON.parse(response.Payload.map(item => {
      //   return item.product;
      // })));
      // callback(null, JSON.parse(response.Payload).transaction[0]);

      // console.log(response.Payload);
      callback(null, response.Payload);
    })
    .catch(error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    })
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
};
