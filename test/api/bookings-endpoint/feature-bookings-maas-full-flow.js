'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const Promise = require('bluebird');
const moment = require('moment');

const createLambda = require('../../../bookings/bookings-create/handler.js');
const retrieveLambda = require('../../../bookings/bookings-retrieve/handler.js');
const cancelLambda = require('../../../bookings/bookings-cancel/handler.js');
const listLambda = require('../../../bookings/bookings-list/handler.js');

const models = require('../../../lib/models');
const Database = models.Database;

module.exports = function (optionsLambda) {

  function runLambda(lambda, event) {
    return new Promise((resolve, reject) => {
      wrap(lambda).run(event, (error, response) => {
        return (error) ? reject(error) : resolve(response);
      });
    });
  }

  describe('create a MaaS Ticket booking for a day', () => {
    const testUserIdentity = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    let optionsResponse;
    let createResponse;
    let event;
    let error;

    // 10 minutes from now
    const startTime = Date.now() + 10 * 60 * 1000;

    // Before each test we check if a previous test has errored. If so, skip
    // the test.
    beforeEach(function () {
      if (error) {
        this.skip();
      }
    });

    it(`Lists the MaaS ticket options at '${moment(startTime).format('DD.MM.YYYY, HH:mm:ss Z')}'`, () => {
      event = {
        identityId: testUserIdentity,
        agencyId: 'MaaS',
        startTime: startTime,
        from: '60.18948,24.97213',
        to: '60.18948,24.97213',
      };

      // Options
      return runLambda(optionsLambda, event)
        .then(
          res => Promise.resolve(optionsResponse = res),
          err => Promise.reject(error = err)
        );
    });

    it('Can create the MaaS ticket', () => {
      event = {
        identityId: testUserIdentity,
        payload: optionsResponse.options[0],
      };
      return runLambda(createLambda, event)
        .then(
          res => Promise.resolve(createResponse = res),
          err => Promise.reject(error = err)
        );
    });

    it('Can retrieve the MaaS ticket', () => {
      event = {
        identityId: testUserIdentity,
        bookingId: createResponse.booking.id,
      };
      let retrieveResponse;

      return runLambda(retrieveLambda, event)
        .then(
          res => Promise.resolve(retrieveResponse = res),
          err => Promise.reject(error = err)
        )
        .then(() => {
          expect(retrieveResponse.booking.state).to.equal('CONFIRMED');
        });

    });

    it('Cannot cancel the MaaS ticket', () => {
      event = {
        identityId: testUserIdentity,
        bookingId: createResponse.booking.id,
      };
      let cancelError;
      let cancelResponse;
      return runLambda(cancelLambda, event)
        .then(
          res => Promise.resolve(cancelResponse = res),
          err => Promise.resolve(cancelError = err)
        )
        .then(() => {
          expect(cancelResponse).to.not.exist;
          expect(cancelError).to.be.instanceof(Error);
        });
    });

    it(`Lists the ticket as part of CONFIRMED tickets starting at '${moment(startTime).format('DD.MM.YYYY, HH:mm:ss Z')}'`, () => {
      event = {
        identityId: testUserIdentity,
        startTime: startTime,
        state: 'CONFIRMED',
      };
      let listResponse;

      return runLambda(listLambda, event)
        .then(
          res => Promise.resolve(listResponse = res),
          // Do not fail on before() errors
          err => {
            Promise.reject(error = err);
          }
        )
        .then(() => {
          const matchingBookings = listResponse.bookings.filter(b => {
            return b.id === createResponse.booking.id;
          });
          expect(matchingBookings).to.have.lengthOf(1);
          expect(matchingBookings[0].state).to.equal('CONFIRMED');
        });
    });

    afterEach(() => {
      if (error) {
        console.log('Caught an error:', error.message);
        console.log('Event:', JSON.stringify(event, null, 2));
        console.log(error.stack);
      }
    });

    after(() => {
      return Database.init()
        .then(() => {
          if (createResponse && createResponse.booking.id) {
            return models.Booking.query().delete().where('id', createResponse.booking.id);
          }

          return Promise.resolve();
        })
        .finally(() => Database.cleanup());
    });
  });
};
