'use strict';

const filter = require('./filter');
const routes = require('./routes');
const pricing = require('./pricing');
const Profile = require('../../../lib/business-objects/Profile');
const Promise = require('bluebird');

function getRoutes(identityId, params) {
  return Promise.all([routes.getRoutes(params), Profile.retrieve(identityId)])
    .spread((routes, profile) => {
      return pricing.resolveRoutesPrice(routes.plan.itineraries, profile)
        .then(_itineraries => {
          routes.plan.itineraries = _itineraries;
          return routes;
        });
    })
    .then(routes => {
      const filterOptions = {
        keepUnpurchasable: true,
        distanceGapThreshold: 180, // %
        walkThreshold: 5000, // meter
        removeIdentical: true,
      };

      // Keep unpurchasable itineraries by default
      routes.plan.itineraries = filter.resolve(routes.plan.itineraries, filterOptions);

      return routes;
    });
}

module.exports = {
  getRoutes,
};
