'use strict';

const businessRuleEngine = require('../../lib/business-rule-engine/index.js');
const utils = require('../../lib/utils');

// Add route and leg identifiers that are unique and also act as
// a signature for the response.
function addRouteAndLegIdentifiersToResponse(response) {
  const itineraries = response.plan.itineraries || [];

  itineraries.map(itinerary => {
    (itinerary.legs || []).map(leg => {
      if (!leg.signature) {
        leg.signature = utils.sign(leg, process.env.MAAS_SIGNING_SECRET);
      }
    });

    itinerary.signature = utils.sign(itinerary, process.env.MAAS_SIGNING_SECRET);
  });

  return response;
}

function filterPastRoutes(leaveAt, response) {
  if (!leaveAt) {
    return response;
  }

  const filtered = response.plan.itineraries.filter(itinerary => {
    const waitingTimes = itinerary.legs.map(leg => {
      const waitingTime = (leg.startTime - parseInt(leaveAt, 10));
      return waitingTime;
    });
    const shortest = Math.min.apply(null, waitingTimes);
    const inMinutes = ((shortest / 1000) / 60);
    const margin = 1;
    if (inMinutes < -margin) {
      return false;
    }

    return true;
  });

  response.plan.itineraries = filtered;
  return response;
}

function getRoutes(identityId, from, to, leaveAt, arriveBy) {

  const event = {
    from: from,
    to: to,
    leaveAt: leaveAt,
    arriveBy: arriveBy,
  };

  return businessRuleEngine.call(
    {
      rule: 'get-routes',
      identityId: identityId,
      parameters: event,
    }
  )
  .then(response => filterPastRoutes(leaveAt, response))
  .then(response => addRouteAndLegIdentifiersToResponse(response));
}

module.exports.respond = function (event, callback) {
  if (!event.identityId) {
    callback(new Error('Authorization error.'));
  } else if (!event.from) {
    callback(new Error('Missing "from" argument.'));
  } else if (!event.to) {
    callback(new Error('Missing "to" argument.'));
  } else if (event.leaveAt && event.arriveBy) {
    callback(new Error('Both "leaveAt" and "arriveBy" provided.'));
  } else {
    getRoutes(event.identityId, event.from, event.to, event.leaveAt, event.arriveBy)
    .then(response => {
      callback(null, response);
    })
    .catch(err => {
      console.info('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(err);
    });
  }

};
