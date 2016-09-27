'use strict';

const Promise = require('bluebird');
const maasOperation = require('../../../lib/maas-operation');
require('events').EventEmitter.defaultMaxListeners = Infinity;

const routes = require('./routes'); // Get routes for input
const pricing = require('./pricing'); // Calculate pricing for the routes
const filter = require('./filter');

function getRoutes(identityId, params) {

  return Promise.all([routes.getRoutes(params), maasOperation.fetchCustomerProfile(identityId)])
    .spread((routes, profile) => {
      return pricing.resolveRoutesPrice(routes.plan.itineraries, profile)
        .then(_itineraries => {
          routes.plan.itineraries = _itineraries;
          return routes;
        });
    })
    .then(routes => {
      routes.plan.itineraries = filter.decide(routes.plan.itineraries, params.keepUnpurchasable ? params.keepUnpurchasable : true); // Keep unpurchasable itineraries by default
      return routes;
    });
}

module.exports = {
  getRoutes,
};
