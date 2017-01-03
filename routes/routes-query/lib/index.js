'use strict';

const bus = require('../../../lib/service-bus');
const Profile = require('../../../lib/business-objects/Profile');
const Promise = require('bluebird');
const filter = require('./filter');
const routes = require('./routes');

function getRoutes(identityId, params) {
  return routes.getRoutes(params)
    .then(routes => {
      return bus.call('MaaS-business-rule-engine', {
         identityId: identityId,
         rule: 'get-route-pricing',
         parameters: routes.plan.itineraries,
      })
    })
    .then(_itineraries => {
      routes.plan.itineraries = _itineraries;
      return routes;
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
