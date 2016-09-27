'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const moment = require('moment');
const models = require('../../../lib/models/index');
const Database = require('../../../lib/models/index.js').Database;

function runLambda(lambda, event) {
  return new Promise((resolve, reject) => {
    wrap(lambda).run(event, (error, response) => {
      if (error) {
        return reject(error);
      }

      return resolve(response);
    });
  });
}

module.exports = function (agencyOptionsLambda, createLambda, cancelLambda, retrieveLambda) {
  describe('cancel a booking, created by bookings-create with the first option retrieved from Sixt agency-option for the next weeks Tuesday starting from 12:00 UTC+2', () => {

    const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
    let optionsResponse;
    let createResponse;
    let cancelResponse;
    let retrieveResponse;
    let error;

    const tueMoment = moment().utcOffset(120).day(7 + 2).hour(12).minute(0).second(0).millisecond(0).valueOf();
    const wedMoment = moment().utcOffset(120).day(7 + 3).hour(12).minute(0).second(0).millisecond(0).valueOf();

    before(() => {
      const agencyOptionsEvent = {
        identityId: testIdentityId,
        agencyId: 'Sixt',
        mode: 'CAR',
        from: '60.3210549,24.9506771',
        to: '',
        startTime: tueMoment,
        endTime: wedMoment,
      };

      return runLambda(agencyOptionsLambda, agencyOptionsEvent)
        .then(response => {
          optionsResponse = response;

          if (optionsResponse.options.length === 0) {
            throw new Error('No Sixt booking options were found');
          }

          // Choose the first option in the list to book
          const bookingOption =  optionsResponse.options[0];
          const bookingEvent = {
            identityId: testIdentityId,
            payload: bookingOption,
          };

          return runLambda(createLambda, bookingEvent);
        })
        .then(response => {
          createResponse = response;

          if (response.booking.state !== 'RESERVED') {
            throw new Error(`Sixt booking not reserved - state ${response.booking.state}`);
          }

          return response;
        })
        .then(response => {
          const cancelEvent = {
            identityId: testIdentityId,
            bookingId: createResponse.booking.id,
          };

          return runLambda(cancelLambda, cancelEvent);
        })
        .then(response => {
          cancelResponse = response;

          const retrieveEvent = {
            identityId: testIdentityId,
            bookingId: createResponse.booking.id,
          };

          return runLambda(retrieveLambda, retrieveEvent);
        })
        .then(response => {
          retrieveResponse = response;
        })
        .catch(_error => {
          error = _error;
        });
    });

    after(() => {
      return Database.init()
        .then(() => {
          if (!createResponse) {
            return Promise.resolve();
          }

          const id = createResponse.booking.id;
          return models.Booking.query().delete().where( 'id', id);
        })
        .then(() => Database.cleanup())
        .then(() => {});
    });

    it('The whole cycle should succeed without error', () => {
      expect(error).to.be.undefined;
    });

    it('bookings-agency-options should return a valid response', () => {
      expect(optionsResponse).to.not.be.undefined;
    });

    it('at least one option should exist', () => {
      expect(optionsResponse.options.length).to.be.above(0);
    });

    it('bookings-create should return a valid response', () => {
      expect(createResponse).to.not.be.undefined;
    });

    it('bookings-cancel should return a booking with state CANCELLED', () => {
      expect(cancelResponse.booking.state).to.equal('CANCELLED');
    });

    it('bookings-retrieve booking should have state CANCELLED', () => {
      expect(retrieveResponse.booking.state).to.equal('CANCELLED');
    });
  });
};
