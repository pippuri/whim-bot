const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment');
const validator = require('../../lib/validator');
const schema = require('../../routes/routes-query/response-schema.json');
const _ = require('lodash');

module.exports = function (lambda, options) {

  if (typeof options === typeof undefined) {
    options = {};
  }

  describe('leaveAt request', function () {

    const event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
    };

    var error;
    var response;

    before(function (done) {
      wrap(lambda).run(event, function (err, data) {
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
        .then((validationError) => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', function () {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    if (options.taxiSupport === true) {
      it('response should have direct taxi route', function () {
        const itinerariesWithoutBus = response.plan.itineraries.filter(itinerary => {
          const modes = _.map(itinerary.legs, 'mode');
          if (_.includes(modes, 'BUS')) {
            return false;
          }

          return true;
        });

        const directTaxiRoutes = itinerariesWithoutBus.filter(itinerary => {
          const modes = _.map(itinerary.legs, 'mode');
          if (_.includes(modes, 'TAXI')) {
            return true;
          }

          return false;
        });

        expect(directTaxiRoutes).to.not.be.empty;
      });
    }
  });
};
