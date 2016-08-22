'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const validator = require('../../../lib/validator');
const moment = require('moment');

module.exports = function (lambda) {

  describe('request agency options for next Tuesday', () => {
    let error;
    let response;

    const now = new Date();
    const dowTuesday = now.getDay() < 2 ? 2 : 2 + 7;
    const dowWednesday = now.getDay() < 2 ? 3 : 3 + 7;
    const nextTuesday = moment().day(dowTuesday).valueOf();
    const nextWednesday = moment().day(dowWednesday).valueOf();

    const validEvent = {
      agencyId: 'Sixt',
      mode: 'CAR',
      from: '60.3210549,24.9506771',
      to: '',
      startTime: nextTuesday,
      endTime: nextWednesday,
    };

    before(done => {
      wrap(lambda).run(validEvent, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should trigger a valid response', () => {
      return validator.validate('maas-backend:bookings-agency-options-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('should succeed without error', () => {
      expect(error).to.be.null;
    });
  });

  describe('request agency options with time in the past', () => {
    let error;
    let response;

    const faultyEvent = {
      agencyId: 'Sixt',
      mode: 'CAR',
      from: '60.3210549,24.9506771',
      to: '',
      startTime: 1468353600,
      endTime: 1468432800,
    };

    before(done => {
      wrap(lambda).run(faultyEvent, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

    // it('should fail with an errorMessage contains "error 23"', () => {
    it('should fail with an errorMessage', () => {
      expect(error).to.exist;
    });
  });
};
