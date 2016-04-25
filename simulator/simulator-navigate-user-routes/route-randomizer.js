var request = require('request-promise');

// Create random routes within this area
var area = [60.1454104, 24.697979, 60.4546686, 25.2032076];

function activateRoute(identityId, idToken, activeRoute) {
  console.log('Activating route:', identityId, activeRoute);

  // Add some required fields to the route
  activeRoute.timestamp = Date.now();
  activeRoute.activeLeg = {
    legId: activeRoute.legs[0].legId,
    timestamp: Date.now(),
  };
  return request({
    method: 'PUT',
    url: 'https://api.dev.maas.global/tracking/active-route',
    json: activeRoute,
    headers: {
      Authorization: 'Bearer ' + idToken,
    },
  })
  .then(() => (

    // Set location to beginning of leg
    request({
      method: 'PUT',
      url: 'https://api.dev.maas.global/tracking/user-location',
      json: {
        legId: activeRoute.legs[0].legId,
        lat: activeRoute.legs[0].from.lat,
        lon: activeRoute.legs[0].from.lon,
        timestamp: Date.now(),
      },
      headers: {
        Authorization: 'Bearer ' + idToken,
      },
    })
  ));
}

function startRandomRoute(identityId, idToken) {
  var from = {
    lat: area[0] + Math.random() * (area[2] - area[0]),
    lon: area[1] + Math.random() * (area[3] - area[1]),
  };
  var to = {
    lat: area[0] + Math.random() * (area[2] - area[0]),
    lon: area[1] + Math.random() * (area[3] - area[1]),
  };
  console.log('Starting random route from ' + from.lat + ',' + from.lon + ' to ' + to.lat + ',' + to.lon);
  return request({
    method: 'GET',
    url: 'https://api.dev.maas.global/routes',
    qs: {
      from: from.lat + ',' + from.lon,
      to: to.lat + ',' + to.lon,
    },
    json: true,
  })
  .then(response => {
    if (response.plan && response.plan.itineraries && response.plan.itineraries.length > 0) {
      // Found some routes, pick one
      var activeRoute;
      var now = Date.now();
      response.plan.itineraries.map(route => {
        if (!activeRoute && route.startTime >= now && route.legs && route.legs.length > 0 && route.legs[0].from && route.legs[0].from.lat && route.legs[0].from.lon) {
          activeRoute = route;
        }
      });
      return activateRoute(identityId, idToken, activeRoute);
    }
  });
}

module.exports.startRandomRoute = startRandomRoute;
