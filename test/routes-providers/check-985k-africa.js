
const wrap = require('lambda-wrapper').wrap;
const chai = require('chai');
const expect = chai.expect;
const moment = require('moment');
const validator = require('../../lib/validator');
const schema = require('../../routes/routes-query/response-schema.json');

module.exports = (lambda) => {

  // Afrikantie bus stop schedule http://aikataulut.reittiopas.fi/pysakit/fi/9219204.html

  describe('request for a bus from Afrikantie bus stop to Keravan Muovi ja Lelu Oy at 15:15', function () {
    const timeZone = +3;

    const event = {
      from: '60.375224,25.2181888', // Afrikantie bus stop
      to: '60.3990481,25.1093918', // Keravan Muovi ja Lelu Oy
      leaveAt: '' + moment().utcOffset(timeZone * 60).isoWeekday(7).add(2, 'days').hour(14).minute(45).valueOf(), // Tuesday one week forward around 15:15
    };

    var error;
    var response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should succeed without errors', function () {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', function () {
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', function () {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    // FIXME change to another bus route, tripgo doesn't return proper route for 985K, 30.5
    xit('response should contain a leg with bus 985K leaving at 15:35', function () {
      var leg985KTimes = [];
      response.plan.itineraries.map(i => {
        i.legs.map(l => {
          if (('' + l.route).includes('985')) {
            leg985KTimes.push(l.startTime);
          }
        });
      });

      expect(leg985KTimes).to.not.be.empty;

      const expectedTime =  moment().utcOffset(timeZone * 60).isoWeekday(7).add(2, 'days').hour(15).minute(35).second(0).millisecond(0).valueOf();
      const timeDifferences = leg985KTimes.map(startTime => {
        return Math.abs(startTime - expectedTime);
      });

      const bestFitDifference = Math.min.apply(0, timeDifferences);
      const inMinutes = ((bestFitDifference / 1000) / 60);

      expect(inMinutes).to.be.below(1300); //error #2 should be less than 1 (180 for Digitransit, 1300 for here)

    });

  });
};
