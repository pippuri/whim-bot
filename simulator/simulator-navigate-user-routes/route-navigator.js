var Promise = require('bluebird');
var request = require('request-promise');

function findLeg(legs, legId) {
  var foundLeg;
  legs.map(leg => {
    if (!foundLeg && leg.legId == legId) {
      foundLeg = leg;
    }
  });
  return foundLeg;
}

function findNextLeg(legs, legId) {
  var foundLeg;
  var nextLeg;
  legs.map(leg => {
    if (foundLeg && !nextLeg) {
      nextLeg = leg;
    } else if (!foundLeg && leg.legId == legId) {
      foundLeg = leg;
    }
  });
  return nextLeg;
}

function continueExistingRoute(identityId, idToken, activeRoute) {
  console.log('Continue existing route:', activeRoute.routeId, 'leg', activeRoute.activeLeg.legId);
  // Check if leg has been completed
  var now = Date.now();
  var leg = findLeg(activeRoute.legs, activeRoute.activeLeg.legId);
  if (!leg) {
    // Invalid route! Should cancel it
    console.log('Leg not found:', activeRoute.activeLeg.legId);
    return;
  }
  var legNumber = activeRoute.legs.indexOf(leg)+1;
  var legTimeLeft = Math.floor((leg.endTime-now)/60000);
  var legTimeElapsed = Math.floor((now-activeRoute.activeLeg.timestamp)/60000);
  var nextLeg = findNextLeg(activeRoute.legs, activeRoute.activeLeg.legId);
  // Proceed to next leg when reached endTime (or for simulation, also when travelled leg for 1 min or more)
  if (legTimeLeft > 0 && legTimeElapsed < 0) {
    console.log('Leg [' + legNumber + '/' + activeRoute.legs.length + '] active for', legTimeElapsed, 'min, ', legTimeLeft, 'min left:', leg);
  } else if (nextLeg) {
    var nextLegNumber = activeRoute.legs.indexOf(nextLeg)+1;
    console.log('Leg [' + nextLegNumber + '/' + activeRoute.legs.length + '] activating now:', nextLeg);
    return request({
      method: 'PUT',
      url: 'https://api.dev.maas.global/tracking/active-route/active-leg',
      json: {
        legId: nextLeg.legId,
        timestamp: Date.now()
      },
      headers: {
        Authorization: 'Bearer ' + idToken
      }
    });
  } else {
    console.log('No more legs left. Route completed!');
    return request({
      method: 'DELETE',
      url: 'https://api.dev.maas.global/tracking/active-route',
      json: true,
      headers: {
        Authorization: 'Bearer ' + idToken
      }
    });
  }
}

module.exports.continueExistingRoute = continueExistingRoute;
