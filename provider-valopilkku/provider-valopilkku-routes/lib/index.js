'use strict';

const Promise = require('bluebird');
const polylineEncoder = require('polyline-extended');
const serviceBus = require('../../../lib/service-bus');

const GEOMETRY_QUERY_MODE = 'TAXI';


function selectOptions(original) {
  /*[XXX: this is in place to handle multiple result options,
          but currently is only returning the first one if available.]
  */
  const ret = [];
  if (original.options.length > 0) {
    ret.push(original.options[0]);
  }

  return ret;
}

function extractFromElement(parsedEvent) {
  return {
    lat: parsedEvent.from[0],
    lon: parsedEvent.from[1],
  };
}

function extractStartTime(option) {
  return option.leg.startTime;
}

function extractEndTime(option) {
  return option.leg.endTime;
}

function extractTaxiLegFromHereResponse(response) {
  // Extract the endTime from the HERE route response
  if (response.plan &&
      response.plan.itineraries &&
      response.plan.itineraries.length > 0 &&
      response.plan.itineraries[0].legs &&
      response.plan.itineraries[0].legs.length > 0) {

    // find the first leg with mode == GEOMETRY_QUERY_MODE
    const ret = response.plan.itineraries[0].legs.find(leg => {
      return leg.mode === GEOMETRY_QUERY_MODE;
    });

    // Only return the leg if we have actually found something
    if (ret) {
      return ret;
    }
  }

  // Throw this so that the error handler can sort it out
  throw new Error('Could not extract taxi leg from HERE response');
}

function extractEndTimeFromHereLegIntoOption(leg, option) {
  if (leg && leg.endTime && option.leg) {
    option.leg.endTime = leg.endTime;
    return;
  }

  // Throw this so that the error handler can sort it out
  throw new Error('Could not extract endTime from HERE leg');
}

function extractGeometryFromHereLeg(leg) {
  if (leg && leg.legGeometry && leg.legGeometry.points) {
    return leg.legGeometry.points;
  }

  // Throw this so that the error handler can sort it out
  throw new Error('Could not extract Geometry from HERE leg');
}

function extractDistanceFromHereLeg(leg) {
  if (leg && leg.distance) {
    return leg.distance;
  }

  // Throw this so that the error handler can sort it out
  throw new Error('Could not extract distance from HERE leg');
}

function getLegGeometryPoints(option) {
  // Call the HERE route provider for a likely driving route
  return serviceBus.call('MaaS-provider-here-routes', {
    from: `${option.leg.from.lat},${option.leg.from.lon}`,
    to: `${option.leg.to.lat},${option.leg.to.lon}`,
    leaveAt: Date.now(),
    modes: GEOMETRY_QUERY_MODE,
  });
}

function buildLeg(option, distance, polyline) {
  return {
    startTime: option.leg.startTime,
    endTime: option.leg.endTime,
    mode: option.leg.mode,
    from: option.leg.from,
    to: option.leg.to,
    agencyId: 'Valopilkku',
    legGeometry: {
      points: polyline,
    },
    distance: distance,
  };
}

function extractWalkingLegs(option) {
  /*TODO: nothing for now,
          but this can return a promise that resolves to an array in the form:
          [ startWalkingLeg, endWalkingLeg ]
  */
  return [];
}

function extractTaxiLeg(option) {
  return getLegGeometryPoints(option)
    .then(response => extractTaxiLegFromHereResponse(response))
    .then(hereLeg => {
      extractEndTimeFromHereLegIntoOption(hereLeg, option);
      const polyline = extractGeometryFromHereLeg(hereLeg);
      const distance = extractDistanceFromHereLeg(hereLeg);

      return buildLeg(option, distance, polyline);
    });
}

function extractAllTaxiLegs(option) {
  const WALKING = 0;
  const TAXI = 1;

  const ret = [];
  return Promise.all([
    extractWalkingLegs(option),
    extractTaxiLeg(option),
  ])
  .then(legResults => {
    // If available add the first walking leg
    if (legResults[WALKING].length > 0) {
      ret.push(legResults[WALKING][0]);
    }

    // Add the taxi leg
    ret.push(legResults[TAXI]);

    // If available add the second walking leg
    if (legResults[WALKING].length > 1) {
      ret.push(legResults[WALKING][1]);
    }

    return ret;
  });
}

function extractItinerary(option) {
  return extractAllTaxiLegs(option)
    .then(legs => {
      return {
        startTime: extractStartTime(option),
        endTime: extractEndTime(option),
        legs: legs,
      };
    });
}

module.exports = {
  selectOptions: selectOptions,
  extractFromElement: extractFromElement,
  extractItinerary: extractItinerary,
};
