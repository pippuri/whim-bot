'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');

function findLeg(legs, legId) {
  let foundLeg;
  legs.map(leg => {
    if (!foundLeg && leg.legId === legId) {
      foundLeg = leg;
    }
  });
  return foundLeg;
}

function findNextLeg(legs, legId) {
  let foundLeg;
  let nextLeg;
  legs.map(leg => {
    if (foundLeg && !nextLeg) {
      nextLeg = leg;
    } else if (!foundLeg && leg.legId === legId) {
      foundLeg = leg;
    }
  });
  return nextLeg;
}

function continueExistingRoute(identityId, idToken, activeRoute) {
  console.info('Continue existing route:', activeRoute.routeId, 'leg', activeRoute.activeLeg.legId);

  // Check if leg has been completed
  const now = Date.now();
  const leg = findLeg(activeRoute.legs, activeRoute.activeLeg.legId);
  if (!leg) {

    // Invalid route! Should cancel it
    return Promise.reject(new Error('Leg not found:' + activeRoute.activeLeg.legId));
  }

  const legNumber = activeRoute.legs.indexOf(leg) + 1;
  const legTimeLeft = Math.floor((leg.endTime - now) / 60000);
  const legTimeElapsed = Math.floor((now - activeRoute.activeLeg.timestamp) / 60000);
  const nextLeg = findNextLeg(activeRoute.legs, activeRoute.activeLeg.legId);

  // Proceed to next leg when reached endTime (or for simulation, also when travelled leg for 1 min or more)
  if (legTimeLeft > 0 && legTimeElapsed < 0) {
    console.info('Leg [' + legNumber + '/' + activeRoute.legs.length + '] active for', legTimeElapsed, 'min, ', legTimeLeft, 'min left:', leg);
    return Promise.resolve();
  }

  if (nextLeg) {
    const nextLegNumber = activeRoute.legs.indexOf(nextLeg) + 1;
    console.info('Leg [' + nextLegNumber + '/' + activeRoute.legs.length + '] activating now:', nextLeg);
    return request.put('https://api.dev.maas.global/tracking/active-route/active-leg', {
      json: {
        legId: nextLeg.legId,
        timestamp: Date.now(),
      },
      headers: {
        Authorization: 'Bearer ' + idToken,
      },
    })
    .then(() => {
      if (!nextLeg.from) {
        return Promise.reject(new Error('Invalid leg.'));
      }

      return request.put('https://api.dev.maas.global/tracking/user-location', {
        json: {
          legId: nextLeg.legId,
          lat: nextLeg.from.lat,
          lon: nextLeg.from.lon,
          timestamp: Date.now(),
        },
        headers: {
          Authorization: 'Bearer ' + idToken,
        },
      });
    });
  }

  console.info('No more legs left. Route completed!');
  return request.delete('https://api.dev.maas.global/tracking/active-route', {
    json: true,
    headers: {
      Authorization: 'Bearer ' + idToken,
    },
  });
}

module.exports.continueExistingRoute = continueExistingRoute;
