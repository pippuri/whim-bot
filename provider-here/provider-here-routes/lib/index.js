'use strict';

const polylineEncoder = require('polyline-extended');
const MaaSError = require('../../../lib/errors/MaaSError.js');

/**
 * Validates a string for not being undefined, null or zero-length
 *
 * @param {string} string - a candidate string to be tested
 * @return true if the string is a >0 length string, false otherwise
 */
function isValidString(string) {
  return typeof string === 'string' && string.length > 0;
}

/**
 * Converts HERE shapes (lat-lon pairs) into Google polyline geometry
 *
 * @param {array} shapes - HERE shapes array
 * @return {string} Google polyline encoded geometry
 */
function toLegGeometry(shapes) {
  const points = shapes.map(value => value.split(',').map(parseFloat));
  return polylineEncoder.encode(points);
}

/**
 * Converts a HERE mode to OpenTripPlanner mode
 *
 * @param {string} mode - HERE mode
 * @param {string} type - HERE public transport type
 * @return {string} OTP mode
 * @see https://developer.here.com/rest-apis/documentation/routing/topics/resource-type-enumerations.html
 */
function toMode(mode, type) {

  switch (mode) {
    case 'bicycle':
      return 'BICYCLE';
    case 'car':
    case 'carHOV':
    case 'truck':
      // Note: Currently we do not serve private navigation, hence assume TAXI
      // when HERE returns car trips
      return 'TAXI';
    case 'pedestrian':
      return 'WALK';
    case 'publicTransport':
    case 'publicTransportTimeTable':
      switch (type) {
        case 'busPublic':
        case 'busTouristic':
        case 'busIntercity':
        case 'busExpress':
          return 'BUS';
        case 'railMetro':
        case 'railMetroRegional':
          return 'SUBWAY';
        case 'railLight':
          return 'TRAM';
        case 'monoRail':
          return 'RAIL';
        case 'railRegional':
        case 'trainRegional':
        case 'trainIntercity':
        case 'trainHighSpeed':
          return 'TRAIN';
        case 'aerial':
          return 'AEROPLANE';
        case 'inclined':
          return 'FUNICULAR';
        case 'water':
          return 'FERRY';
        case 'privateService':
        // TODO Assumption: Private service happens through private transport
          return 'TAXI';
        default:
      }
      break;
    default:
  }

  // We should never get this far, unless one of the defaults failed
  throw new MaaSError(`Unknown HERE mode ${mode} (transport type ${type})`, 500);
}

/**
 * Converts a HERE position and roadName to a OpenTripPlanner place
 *
 * @param {object} position - a HERE position (latitude-longitude pair)
 * @param {string} name - a name to assign to the place
 * @return {object} OpenTripPlanner place
 */
function toPlace(position, name) {
  return {
    name: name,
    lat: position.latitude,
    lon: position.longitude,
  };
}

/**
 * Converts HERE company/line name to OpenTripPlanner agencyId
 *
 * TODO This should be removed - the conversion should be done in routes-query.
 *
 * @param {string} companyName - the name of the company
 * @param {string} lineName - the name of the line
 * @return {string} agencyId, or undefined if not mappable
 */
function toAgencyId(companyName, lineName) {
  if (companyName === 'Helsingin seudun liikenne') {
    return 'HSL';
  }

  const HSL_TRAINS  = ['I', 'K', 'N', 'A', 'E', 'L', 'P', 'U', 'X'];
  if (HSL_TRAINS.some(train => train === lineName)) {
    return 'HSL';
  }

  return undefined;
}

/**
 * Converts an array of HERE maneuvers to OTP legs.
 *
 * @param {array} maneuvers - HERE maneuvers sharing the same data
 * @param {array} maneuverGroups - HERE maneuver groups containing mode info
 * @param {array} publicTransportLines - HERE  public transport line info
 * @return {array} array containing OTP compatible legs
 */
function toLegs(maneuvers, maneuverGroups, publicTransportLines) {

  // Defaults (to prevent crashes)
  publicTransportLines = publicTransportLines || [];
  maneuverGroups = maneuverGroups || [];

  // Initialise leg information that is not per-leg, but depends on preceeding
  // legs. Some maneuvers are split into two, hence we can't do 'map' operation.
  const legs = [];

  maneuverGroups.forEach(group => {
    // HERE maneuver groups group the maneuvers by vehicle, e.g. they match
    // OTP legs. They refer to maneuvers with ids 'M1, M2, M3 etc...' as index.
    // Use the 1st regex match group to get the numeric part
    const regex = /M(\d+)/;
    const startIndex = group.firstManeuver.match(regex)[1];
    const endIndex = group.lastManeuver.match(regex)[1];
    const first = maneuvers[startIndex - 1];
    const last = maneuvers[endIndex - 1];

    let legStartTime = (new Date(first.time)).valueOf();

    if (!startIndex || !endIndex) {
      throw new MaaSError(`Invalid maneuver group ${JSON.stringify(group)}`, 500);
    }

    // Iterate the maneuvers using the 1-based start and end indexes.
    // Use their combined travel time, length, line and shape.
    let travelTime = 0;
    let length = 0;
    let line;
    const shape = [];
    for (let i = startIndex - 1; i < endIndex; i++) {
      const m = maneuvers[i];
      travelTime += m.travelTime;
      length += m.length;

      // In case of a waiting leg, append that right away, and exclude
      // waiting time from travel time
      if (m.waitTime && m === first) {
        const waitingLeg = {
          startTime: legStartTime,
          endTime: legStartTime + m.waitTime * 1000,
          mode: 'WAIT',
        };
        legs.push(waitingLeg);
        travelTime -= m.waitTime;
        legStartTime = waitingLeg.endTime;
      }

      if (m.line) {
        line = m.line;
      }

      // Combine maneuver shapes. The last item of the shape geometry is
      // always the same as the first item of the next geometry. Prune it away.
      shape.splice.apply(shape, [shape.length, 0].concat(m.shape));
      if (i < endIndex - 1) {
        shape.pop();
      }
    }

    // Find the transport line information, if any
    const l = publicTransportLines.find(l => l.id === line);

    // Labels for from, to, and route short and long names can be inferred from
    // HERE road names and long names, stop names etc. They are often missing
    // or empty, so compose a list of them in priority order, pick the first
    // applicable, or return undefined.
    const fromName = [].concat(
      first.stopName,
      (first.nextRoadName && first.nextRoadNumber) ? `${first.nextRoadName} ${first.nextRoadNumber}` : undefined,
      first.nextRoadName
    ).find(isValidString);
    const toName = [].concat(
      last.stopName,
      (last.nextRoadName && last.nextRoadNumber) ? `${last.nextRoadName} ${last.nextRoadNumber}` : undefined,
      last.nextRoadName,
      (last.roadName && last.roadNumber) ? `${last.roadName} ${last.roadNumber}` : undefined,
      last.roadName
    ).find(isValidString);
    const shortName = [].concat(
      (l ? [l.lineName, l.destination] : []),
      first.roadName
    ).find(isValidString);
    const longName = [].concat(
      (l ? [l.destination, l.lineName] : []),
      first.roadName
    ).find(isValidString);
    const companyName = (l ? [l.companyName] : []).find(isValidString);
    const lineName = (l ? [l.lineName] : []).find(isValidString);

    // Update the next leg start from when the current one has finished.
    // HERE time units are in seconds.
    const legEndTime = legStartTime + 1000 * travelTime;

    // Form and return a new leg from the data
    legs.push({
      from: toPlace(first.position, fromName),
      to: toPlace(last.position, toName),
      startTime: legStartTime,
      endTime: legEndTime,
      mode: toMode(group.mode, group.publicTransportType),
      distance: length,
      routeShortName: shortName,
      routeLongName: longName,
      agencyId: toAgencyId(companyName, lineName),
      legGeometry: {
        points: toLegGeometry(shape),
      },
    });
  });

  return legs;
}

/**
 * Converts a HERE route to OpenTripPlanner itinerary
 *
 * Note: Start time is given, because HERE does not always give departure time.
 *
 * @param {object} route - the HERE route
 * @return {object} OTP compatible itinerary
 * @see https://developer.here.com/rest-apis/documentation/routing/topics/resource-type-route.html
 */
function toItinerary(route) {
  // Convert waypoints to legs, then merge the duplicate legs
  // Invalid itinerary - no legs
  if (route.leg.length === 0) {
    throw new MaaSError('Invalid itinerary, no valid legs received from HERE', 500);
  }

  // HERE route is a linked data structure, having transport names in
  // publicTransportLine array, modes in maneuverGroup array
  const legs = route.leg
    .map(leg => {
      const maneuvers = leg.maneuver;
      const maneuverGroups = route.maneuverGroup;
      const lines = route.publicTransportLine;
      return toLegs(maneuvers, maneuverGroups, lines);
    })
    .reduce((leg, legs) => legs.concat(leg), []);

  return {
    startTime: legs[0].startTime,
    endTime: legs[legs.length - 1].endTime,
    legs: legs,
  };
}

module.exports = {
  toItinerary,
  toLegGeometry,
  toLegs,
  toMode,
  toPlace,
};
