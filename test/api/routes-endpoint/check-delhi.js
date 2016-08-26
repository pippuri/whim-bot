'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment');

const validator = require('../../../lib/validator');

module.exports = function (lambda) {

  describe('request for a route from Helsinki to Delhi', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      from: '60.1684126,24.9316739', // SC5 Office, Helsinki
      to: '77.2388263,28.6561592',   // Red Fort, New Delhi
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
      arriveBy: '',
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
      return validator.validate('maas-backend:routes-query-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should not have route', () => {
      expect(response.plan.itineraries).to.be.empty;
    });

  });
};
