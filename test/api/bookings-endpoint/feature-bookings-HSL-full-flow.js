'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const Promise = require('bluebird');
const moment = require('moment');
const utils = require('../../../lib/utils');

const optionsLambda = require('../../../bookings/bookings-agency-options/handler.js');
const createLambda = require('../../../bookings/bookings-create/handler.js');
const retrieveLambda = require('../../../bookings/bookings-retrieve/handler.js');
const cancelLambda = require('../../../bookings/bookings-cancel/handler.js');
const listLambda = require('../../../bookings/bookings-list/handler.js');
const Profile = require('../../../lib/business-objects/Profile');

const models = require('../../../lib/models');
const Database = models.Database;

module.exports = function () {

  function runLambda(lambda, event) {
    return new Promise((resolve, reject) => {
      wrap(lambda).run(event, (error, response) => {
        return (error) ? reject(error) : resolve(response);
      });
    });
  }

  describe('create a HSL Ticket booking for a day', () => {
    const testUserIdentity = 'eu-west-1:00000000-cafe-cafe-cafe-000000000004';

    let optionsResponse;
    let createResponse;
    let retrieveResponse;
    let cancelResponse;
    let listResponse;

    let event;
    let error;

    let startingBalance;
    let midBalance;
    let endBalance;

    let cancelError;

    // 10 minutes from now
    const startTime = Date.now() + 10 * 60 * 1000;

    // Before each test we check if a previous test has errored. If so, skip
    // the test.
    beforeEach(function () {
      if (error) {
        this.skip();
      }
    });

    before(() => {
      if (error) {
        this.skip();
      }

      // fetch user data to get account starting balance
      return Profile.retrieve(testUserIdentity)
        .then(profile => (startingBalance = profile.balance));
    });


    it(`Lists the HSL ticket options at '${moment(startTime).format('DD.MM.YYYY, HH:mm:ss Z')}'`, () => {
      event = {
        identityId: testUserIdentity,
        agencyId: 'HSL',
        mode: 'BUS',
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

    it('Can create the HSL ticket', () => {
      // put fare if there is none
      const booking = utils.cloneDeep(optionsResponse.options[0]);
      console.log(JSON.stringify(booking, null, 2));
      event = {
        identityId: testUserIdentity,
        payload: booking,
      };

      return runLambda(createLambda, event)
        .then(
          res => Promise.resolve(createResponse = res),
          err => Promise.reject(error = err)
        )
        .then(() => {
          return Profile.retrieve(testUserIdentity)
            .then(profile => (midBalance = profile.balance));
        });
    });

    it('User balance is reduced by fare', () => {
      expect(startingBalance - (createResponse.booking.fare.amount || 0)).to.equal(midBalance);
    });

    it('Can retrieve the HSL ticket', () => {
      event = {
        identityId: testUserIdentity,
        bookingId: createResponse.booking.id,
      };

      return runLambda(retrieveLambda, event)
        .then(
          res => Promise.resolve(retrieveResponse = res),
          err => Promise.reject(error = err)
        )
        .then(() => {
          expect(retrieveResponse.booking.state).to.equal('CONFIRMED');
        });
    });

    it('Cannot cancel the HSL ticket', () => {
      event = {
        identityId: testUserIdentity,
        bookingId: createResponse.booking.id,
      };
      return runLambda(cancelLambda, event)
        .then(
          res => Promise.resolve(cancelResponse = res),
          err => Promise.resolve(cancelError = err)
        )
        .then(() => {
          expect(cancelResponse).to.not.exist;
          expect(cancelError).to.be.instanceof(Error);
        })
        .then(() => {
          return Profile.retrieve(testUserIdentity)
            .then(profile => (endBalance = profile.balance));
        });
    });

    it('Fare is refunded if clean cancel', () => {
      if (cancelResponse && cancelResponse.state === 'CANCELLED') {
        expect(startingBalance).to.equal(endBalance);
      } else {
        expect(startingBalance - (createResponse.booking.fare.amount || 0)).to.equal(endBalance);
      }
    });

    it(`Lists the ticket as part of CONFIRMED tickets starting at '${moment(startTime).format('DD.MM.YYYY, HH:mm:ss Z')}'`, () => {
      event = {
        identityId: testUserIdentity,
        startTime: startTime,
        state: 'CONFIRMED',
      };

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

    after(() => {
      console.log('List options', JSON.stringify(optionsResponse, null, 2));
      console.log('Create booking', JSON.stringify(createResponse, null, 2));
      console.log('Retrieve booking', JSON.stringify(retrieveResponse, null, 2));
      console.log('Cancel booking', JSON.stringify(cancelResponse, null, 2));
      console.log('List bookings', JSON.stringify(listResponse, null, 2));
    });
  });
};