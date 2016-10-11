'use strict';

const Promise = require('bluebird');
const polylineEncoder = require('polyline-extended');
const utils = require('../../../lib/utils');

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
  return option.leg.startTime;
}

function getLegGeometryPoints(option) {
  return new Promise((resolve, reject) => {
    /*[XXX: For now just a straight line, `from` -> `to`
            but promisified in case we want to call another service/etc.]
    */
    const points = [
      [option.leg.from.lat, option.leg.from.lon],
      [option.leg.to.lat, option.leg.to.lon],
    ];

    return resolve(points);
  });
}

function buildLeg(option, points) {
  const polyline = polylineEncoder.encode(points);
  const distance = polylineEncoder.length(polyline);

  return {
    startTime: option.leg.startTime,
    endTime: option.leg.endTime,
    mode: option.leg.mode,
    from: option.leg.from,
    to: option.leg.to,
    agencyId: option.leg.agencyId,
    legGeometry: {
      points: polyline,
    },
    distance: distance,
  };
}

function signLeg(leg) {
  leg.signature = utils.sign(leg, process.env.MAAS_SIGNING_SECRET);
  return leg;
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
    .then(points => buildLeg(option, points))
    .then(leg => signLeg(leg));
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

