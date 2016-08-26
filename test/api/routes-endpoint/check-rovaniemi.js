'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment');

const validator = require('../../../lib/validator');

module.exports = function (lambda) {

  describe.skip('request for a route to Rovaniemi', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      from: '60.1684126,24.9316739', // SC5 Office, Helsinki
      to: '66.5436144,25.8470606', // Santa Claus Village, Rovaniemi
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

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

  });
};
