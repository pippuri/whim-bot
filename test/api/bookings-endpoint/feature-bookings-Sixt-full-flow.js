'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const moment = require('moment-timezone');
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
  describe('full Sixt booking cycle on Tuesday starting from 12:00 UTC+2', () => {

    let event;
    let optionsResponse;
    let createResponse;
    let cancelResponse;
    let retrieveResponse;
    let error;

    const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000007';
    const tueMoment = moment().tz('Europe/Helsinki').day(7 + 2).hour(12).minute(0).second(0).millisecond(0).valueOf();
    const wedMoment = moment().tz('Europe/Helsinki').day(7 + 3).hour(12).minute(0).second(0).millisecond(0).valueOf();

    // Before each test we check if a previous test has errored. If so, skip
    // the test.
    beforeEach(function () {
      if (error) {
        this.skip();
      }
    });

    it('fetches the agency options', () => {
      event = {
        identityId: testIdentityId,
        agencyId: 'Sixt',
        mode: 'CAR',
        from: '60.3210549,24.9506771',
        to: '',
        startTime: tueMoment,
        endTime: wedMoment,
      };

      return runLambda(agencyOptionsLambda, event)
        .then(
          res => Promise.resolve(optionsResponse = res),
          err => Promise.reject(error = err)
        );
    });

    it('returns a valid response with at least one valid option', () => {
      expect(optionsResponse).to.not.be.undefined;
      expect(optionsResponse.options.length).to.be.above(0);
    });

    it('creates a booking from the first valid option', () => {
      // Choose the first option in the list to book
      const bookingOption = optionsResponse.options[0];
      event = {
        identityId: testIdentityId,
        payload: bookingOption,
      };

      return runLambda(createLambda, event)
        .then(
          res => Promise.resolve(createResponse = res),
          err => Promise.reject(error = err)
        );
    });

    it('creates the booking in state RESERVED', () => {
      expect(createResponse.booking.state).to.equal('RESERVED');
    });

    it('cancels the reserved booking', () => {
      event = {
        identityId: testIdentityId,
        bookingId: createResponse.booking.id,
      };

      return runLambda(cancelLambda, event)
      .then(
        res => Promise.resolve(cancelResponse = res),
        err => Promise.reject(error = err)
      );
    });

    it('cancels the booking with state CANCELLED', () => {
      expect(cancelResponse.booking.state).to.equal('CANCELLED');
    });

    it('retrieves the cancelled booking', () => {
      event = {
        identityId: testIdentityId,
        bookingId: createResponse.booking.id,
        refresh: 'true',
      };

      return runLambda(retrieveLambda, event)
      .then(
        res => Promise.resolve(retrieveResponse = res),
        err => Promise.reject(error = err)
      );
    });

    it('the cancelled booking, when retrieved has state CANCELLED', () => {
      expect(retrieveResponse.booking.state).to.equal('CANCELLED');
    });

    afterEach(() => {
      if (error) {
        console.log('Caught an error:', error.message);
        console.log('Event:', JSON.stringify(event, null, 2));
        console.log(error.stack);
      }
    });

    after(() => {
      /*console.log('List options', JSON.stringify(optionsResponse, null, 2));
      console.log('Create booking', JSON.stringify(createResponse, null, 2));
      console.log('Retrieve booking', JSON.stringify(retrieveResponse, null, 2));
      console.log('Cancel booking', JSON.stringify(cancelResponse, null, 2));*/

      return Database.init()
        .then(() => {
          if (!createResponse) {
            return Promise.resolve();
          }

          const id = createResponse.booking.id;
          return models.Booking.query().delete().where( 'id', id);
        })
        .then(() => Database.cleanup())
        .catch(err => {
          error = err;
          return Promise.reject(err);
        });
    });
  });
};
