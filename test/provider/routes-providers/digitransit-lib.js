'use strict';

const expect = require('chai').expect;
const moment = require('moment-timezone');

module.exports = function (lib) {

  describe('daylight saving times', () => {
    const UTC_SUMMER_OFFSET = 2 * 60 * 60 * 1000;
    const UTC_WINTER_OFFSET = 3 * 60 * 60 * 1000;

    it('Computes UTC offset of Finnish summer time correctly', () => {
      const lastMinuteSummer =
        moment.tz('2016-10-29 02:59', 'Europe/Helsinki').valueOf();
      const firstMinuteWinter =
        moment.tz('2016-10-30 03:01', 'Europe/Helsinki').valueOf();
      const lastMinuteWinter =
        moment.tz('2017-03-26 02:59', 'Europe/Helsinki').valueOf();
      const firstMinuteSummer =
        moment.tz('2017-03-26 04:01', 'Europe/Helsinki').valueOf();

      expect(lib.getUTCOffset(lastMinuteSummer)).to.equal(UTC_SUMMER_OFFSET);
      expect(lib.getUTCOffset(firstMinuteWinter)).to.equal(UTC_WINTER_OFFSET);
      expect(lib.getUTCOffset(lastMinuteWinter)).to.equal(UTC_WINTER_OFFSET);
      expect(lib.getUTCOffset(firstMinuteSummer)).to.equal(UTC_SUMMER_OFFSET);
    });
  });
};
