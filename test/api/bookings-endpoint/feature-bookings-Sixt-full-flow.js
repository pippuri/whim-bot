'use strict';

// const _ = require('lodash');
const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
// const utils = require('../../../lib/utils/index');
const moment = require('moment');
const models = require('../../../lib/models/index');
const Database = require('../../../lib/models/index.js').Database;

module.exports = function (agencyOptionLambda, createLambda, cancelLambda, retrieveLambda) {

  describe('cancel a booking, created by bookings-create with the first option retrieved from Sixt agency-option for the next weeks Tuesday starting from 12:00 UTC+2', () => {

    let agencyOption;
    let optionError;
    let optionResponse;

    let createdBooking;
    let createError;
    let createResponse;

    let cancelError;
    let cancelResponse;

    let retrieveError;
    let retrievedBooking;

    const tueMoment = moment().utcOffset(120).day(7 + 2).hour(12).minute(0).second(0).millisecond(0).valueOf();
    const wedMoment = moment().utcOffset(120).day(7 + 3).hour(12).minute(0).second(0).millisecond(0).valueOf();

    before(done => {

      const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
      const agencyOptionEvent = {
        identityId: testIdentityId,
        agencyId: 'Sixt',
        mode: 'CAR',
        from: '60.3210549,24.9506771',
        to: '',
        startTime: tueMoment,
        endTime: wedMoment,
      };

      return Promise.resolve()
        .then(() => new Promise((resolve, reject) => {
          wrap(agencyOptionLambda).run(agencyOptionEvent, (error, response) => {
            if (error) {
              optionError = error;
              reject(optionError);
            } else {
              optionResponse = response;
              resolve(response);
            }
          });
        }))
        .then(optionsList => new Promise((resolve, reject) => {
          agencyOption = optionsList.options[0]; // Choose first one in the list to book

          const bookingEvent = {
            identityId: testIdentityId,
            payload: agencyOption,
          };

          wrap(createLambda).run(bookingEvent, (error, response) => {
            if (error) {
              createError = error;
              reject(createError);
            } else {
              createResponse = response;
              resolve(response);
            }
          });
        }))
        .then(booking => new Promise((resolve, reject) => {

          createdBooking = booking;

          const cancelEvent = {
            identityId: testIdentityId,
            bookingId: booking.id,
          };

          wrap(cancelLambda).run(cancelEvent, (error, response) => {
            if (error) {
              cancelError = error;
              reject(cancelError);
            } else {
              cancelResponse = response;
              resolve(response);
            }
          });
        }))
        .then(cancelResponse => new Promise((resolve, reject) => {
          const retrieveEvent = {
            identityId: testIdentityId,
            bookingId: createdBooking.id,
          };

          wrap(retrieveLambda).run(retrieveEvent, (error, response) => {
            if (error) {
              retrieveError = error;
              reject(retrieveError);
            } else {
              retrievedBooking = response;
              resolve(retrievedBooking);
            }
          });
        }))
        .then(() => done())
        .catch(error => {
          done(error);
        });

    });

    after( done => {
      return Promise.resolve(Database.init())
        .then(() => {
          if ( createdBooking ) {
            return models.Booking.query().delete().where( 'id', createdBooking.id );
          }
          return Promise.resolve();
        } )
        .then(() => Database.cleanup())
        .then(() => done());
    });

    it('options fetching should succeed without error', () => {
      expect(optionError).to.be.undefined;
    });

    it('options fetching should return a valid response', () => {
      expect(optionResponse).to.not.be.undefined;
    });

    it('first agency option should exist', () => {
      expect(agencyOption).to.not.be.undefined;
    });

    it('booking create should succeed without error', () => {
      expect(createError).to.be.undefined;
    });

    it('booking create should return a valid response', () => {
      expect(createResponse).to.not.be.undefined;
    });

    it('cancel the booking should succeed without error', () => {
      expect(cancelError).to.be.undefined;
    });

    it('cancel the booking should succeed without error', () => {
      expect(cancelResponse).to.not.be.undefined;
    });

    it('bookings-cancel lambda should return a booking with state CANCELLED', () => {
      expect(cancelResponse.state).to.equal('CANCELLED');
    });

    it('retrieve cancelled booking should have state CANCELLED', () => {
      expect(retrievedBooking.state).to.equal('CANCELLED');
    });
  });
};
