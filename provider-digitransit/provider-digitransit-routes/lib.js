'use strict';

/**
 * Digitransit utility methods - separated to enable unit testing
 */
const gregorian = require('gregorian');

const UTC_SUMMER_OFFSET = 2 * 60 * 60 * 1000;
const UTC_WINTER_OFFSET = 3 * 60 * 60 * 1000;

function getUTCOffset(date) {
  // Determine the UTC offset from daylight saving time between last Sunday
  // of October 3AM (UTC 0AM) and last Sunday of March (4AM) (UTC 1AM).
  // Note that month indexes are 0-based, days are 1-based
  // Sunday X.3. 2AM UTC
  const summerStarts = gregorian.reform(date)
    .setUTC(3, 'm').setUTC(31, 'd').setUTC(0, 'D').setUTC(1, 'h').setUTC(0, 't')
    .restartUTC('s').recite().valueOf();
  // Sunday X.10 0AM UTC
  const summerEnds = gregorian.reform(date)
    .setUTC(10, 'm').setUTC(31, 'd').setUTC(0, 'D').setUTC(0, 'h').setUTC(0, 't')
    .restartUTC('s').recite().valueOf();
  const d = date.valueOf();

  if (summerStarts <= d && d < summerEnds) {
    return UTC_SUMMER_OFFSET;
  }
  return UTC_WINTER_OFFSET;
}

function getOTPDate(date) {
  // Compute a date that is localised to Finland
  const d = new Date(date.valueOf() + getUTCOffset(date));
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function getOTPTime(date) {
  // Compute a date that is localised to Finland
  const d = new Date(date.valueOf() + getUTCOffset(date));
  return `${d.getUTCHours()}:${d.getUTCMinutes()}:${d.getUTCSeconds()}`;
}

function convertDigitransitModes(eventModes) {
  if (!eventModes) return 'BUS,TRAM,RAIL,SUBWAY,FERRY,WALK,BICYCLE';
  return eventModes.split(',').map(mode => {
    switch (mode) {
      case 'PUBLIC_TRANSIT':
        return 'BUS,TRAM,RAIL,SUBWAY,FERRY,WALK';
      case 'TAXI':
        return 'CAR';
      case 'CAR':
      case 'WALK':
      case 'BICYCLE':
      default:
        return mode;
    }
  }).join(',');
}

module.exports = {
  getUTCOffset,
  getOTPDate,
  getOTPTime,
  convertDigitransitModes,
};
