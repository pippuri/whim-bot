'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment-timezone');
const schema = require('maas-schemas/');
const validator = require('../../../lib/validator');

module.exports = function (lambda) {

  // Monday one week forward around five
  const arriveBy = moment().tz('Europe/Helsinki').day(8).hour(17).minute(0).second(0);

  describe(`arriveby request at ${arriveBy.format()}`, () => {

    const event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      arriveBy: `${arriveBy.valueOf()}`,
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

    xit('should trigger a valid response', () => {
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

  });
};
