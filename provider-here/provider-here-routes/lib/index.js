'use strict';

const Promise = require('bluebird');
const polylineEncoder = require('polyline-extended');
const MaaSError = require('../../../lib/errors/MaaSError');
const _ = require('lodash');

function convertToLegGeometry(shapes) {

  // Output: [[12.12,34.23],[11.12,33.23],...]
  const points = shapes.map(val => [Number(val.split(',')[0]), Number(val.split(',')[1])]);
  return polylineEncoder.encode(points);
}

function convertLegType(legType) {
  switch (legType) {
    case 'railLight':
    case 'trainRegional':
    case 'railRegional':
      return 'TRAIN';

    case 'busLight':
    case 'busPublic':
      return 'BUS';

    case 'railMetro':
      return 'SUBWAY';

    case 'carPrivate':
      return 'CAR';

    default:
      throw new MaaSError(`Unknown HERE leg type: ${legType}`, 500);
  }
}

function convertCarLeg(leg, route, startTime, travelTime) {

  return {
    startTime: startTime,
    endTime: startTime + travelTime * 1000,
    mode: 'CAR',
    from: {
      name: leg.start.label,
      lat: leg.start.mappedPosition.latitude,
      lon: leg.start.mappedPosition.longitude,
    },
    to: {
      lat: leg.end.mappedPosition.latitude,
      lon: leg.end.mappedPosition.longitude,
      name: leg.end.label,
    },
    legGeometry: {
      points: convertToLegGeometry([
        `${leg.start.mappedPosition.latitude},${leg.start.mappedPosition.longitude}`, `${leg.end.mappedPosition.latitude},${leg.end.mappedPosition.longitude}`,
      ]),
    },
    distance: leg.length,
  };
}

/**
 * Merge all maneuver legs into one
 */
function _mergeManeuverLegs(legs) {
  if (!(legs instanceof Array)) {
    return Promise.reject(new MaaSError('Input walking legs for combination are not array.', 500));
  }
  if (legs.length === 0) return [];
  // Return an array as input is array

  if (legs.length === 1) return legs;

  if (legs.length > 1 && legs[0].mode !== legs[1].mode) {
    return Promise.reject(new MaaSError('Cannot merge maneuver legs, different mode input', 500));
  }

  return [
    {
      startTime: legs[0].startTime,
      endTime: legs[legs.length - 1].endTime,
      mode: legs[0].mode,
      from: legs[0].from,
      to: legs[legs.length - 1].to,
      legGeometry: {
        points: polylineEncoder.mergePolylines(legs.map(leg => leg.legGeometry.points)),
      },
      distance: _.sum(legs.map(leg => leg.distance)),
    },
  ];
}

// Group all maneuver legs into 1
function groupManeuverLegs(legs) {
  const result = [];
  let sameModeLegs = [];

  for (let i = 0; i < legs.length - 1; i++) {
    if (legs[i].mode === legs[i + 1].mode) {
      sameModeLegs.push(legs[i]);

      if (i === legs.length - 2) { // eslint-disable-line
        sameModeLegs.push(legs[i + 1]);
        result.push(_mergeManeuverLegs(sameModeLegs));
      }
    } else {
      sameModeLegs.push(legs[i]);
      result.push(_mergeManeuverLegs(sameModeLegs));
      sameModeLegs = [];

      if (i === legs.length - 2) { // eslint-disable-line
        result.push(_mergeManeuverLegs(sameModeLegs));
        result.push([legs[i + 1]]);
      }
    }
  }

  return _.flatten(result);
}

// Here has this weird leg that have no distance and startTime === endTime
function removeRedundantLeg(legs) {
  return legs.filter(leg => {
    return (leg.startTime !== leg.endTime);
  });
}

module.exports = {
  convertToLegGeometry,
  convertLegType,
  convertCarLeg,
  groupManeuverLegs,
  removeRedundantLeg,
};
