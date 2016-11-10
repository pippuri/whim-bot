'use strict';

const chai = require('chai');
const expect = chai.expect;
const moment = require('moment-timezone');
const schema = require('maas-schemas/prebuilt/maas-backend/provider/routes/response');
const utils = require('../../../lib/utils');
const validator = require('../../../lib/validator');
const wrap = require('lambda-wrapper').wrap;

module.exports = function (lambda) {

  // Afrikantie bus stop schedule http://aikataulut.reittiopas.fi/pysakit/fi/9219204.html
  // Tuesday one week forward around 15:15
  const leaveAt = moment().tz('Europe/Helsinki').day(9).hour(14).minute(45).second(0);

  // Tuesday one week forward around 15:45
  describe(`request for a bus from Afrikantie bus stop to Keravan Muovi ja Lelu Oy at ${leaveAt.format()}`, () => {
    const event = {
      from: '60.375224,25.2181888', // Afrikantie bus stop
      to: '60.3990481,25.1093918', // Keravan Muovi ja Lelu Oy
      leaveAt: `${leaveAt.valueOf()}`,
    };

    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.null;
    });

    it('should trigger a valid response after sanification', () => {
      return validator.validate(schema, utils.sanitize(response));
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    // FIXME change to another bus route, tripgo doesn't return proper route for 985K, 30.5
    xit('response should contain a leg with bus 985K leaving at 15:35', () => {
      const leg985KTimes = [];
      response.plan.itineraries.map(i => {
        i.legs.map(l => {
          if (('' + l.route).includes('985')) {
            leg985KTimes.push(l.startTime);
          }
        });
      });

      expect(leg985KTimes).to.not.be.empty;

      const expectedTime =  moment().tz('Europe/Helsinki').day(9).hour(15).minute(35).second(0).millisecond(0).valueOf();
      const timeDifferences = leg985KTimes.map(startTime => {
        return Math.abs(startTime - expectedTime);
      });

      const bestFitDifference = Math.min.apply(0, timeDifferences);
      const inMinutes = ((bestFitDifference / 1000) / 60);

      expect(inMinutes).to.be.below(1300); //error #2 should be less than 1 (180 for Digitransit, 1300 for here)

    });

  });
};
