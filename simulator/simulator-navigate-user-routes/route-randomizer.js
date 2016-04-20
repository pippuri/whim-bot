var Promise = require('bluebird');
var request = require('request-promise');

// Create random routes within this area
var area = [60.1454104, 24.697979, 60.4546686,25.2032076];

function startRandomRoute(identityId, idToken) {
  var from = {
    lat: area[0] + Math.random() * (area[2]-area[0]),
    lon: area[1] + Math.random() * (area[3]-area[1])
  };
  var to = {
    lat: area[0] + Math.random() * (area[2]-area[0]),
    lon: area[1] + Math.random() * (area[3]-area[1])
  };
  console.log('Starting random route from ' + from.lat + ',' + from.lon + ' to ' + to.lat + ',' + to.lon);
  return request({
    method: 'GET',
    url: 'https://api.dev.maas.global/routes',
    qs: {
      from: from.lat + ',' + from.lon,
      to: to.lat + ',' + to.lon
    },
    json: true
  })
  .then(response => {
    if (response.plan && response.plan.itineraries && response.plan.itineraries.length > 0) {
      // Found some routes, pick one
      var activeRoute;
      var now = Date.now();
      response.plan.itineraries.map(route => {
        if (!activeRoute && route.startTime >= now) {
          activeRoute = route;
        }
      });
      return activateRoute(identityId, idToken, activeRoute);
    }
  });
}

function activateRoute(identityId, idToken, activeRoute) {
  console.log('Activating route:', identityId, activeRoute);
  // Add some required fields to the route
  activeRoute.timestamp = Date.now();
  activeRoute.activeLeg = {
    legId: activeRoute.legs[0].legId,
    timestamp: Date.now()
  };
  return request({
    method: 'PUT',
    url: 'https://api.dev.maas.global/tracking/active-route',
    json: activeRoute,
    headers: {
      Authorization: 'Bearer ' + idToken
    }
  });
}

module.exports.startRandomRoute = startRandomRoute;
