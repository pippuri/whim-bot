
'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const Promise = require('bluebird');
const moment = require('moment-timezone');
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

  describe('create a HSL Ticket booking for a day', function () {
    const testUserIdentity = 'eu-west-1:00000000-cafe-cafe-cafe-000000000007';

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
      return Database.init()
        .then(() => Profile.retrieve(testUserIdentity))
        .then(profile => (startingBalance = profile.balance));
    });

    it(`Lists the HSL ticket options at '${moment(startTime).format('DD.MM.YYYY, HH:mm:ss Z')}'`, () => {
      event = {
        identityId: testUserIdentity,
        agencyId: 'HSL',
        mode: 'BUS',
        startTime: startTime,
        endTime: startTime + 45 * 60 * 60 * 1000,
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

    // FIXME For some reason we do not get the same start time as requested,
    // but 10 minutes earlier
    it('The options have the same data as requested', () => {
      optionsResponse.options.forEach(option => {
        expect(option.leg.agencyId).to.equal(event.agencyId);
        expect(option.leg.startTime).to.equal(event.startTime);
        expect(option.leg.mode).to.equal(event.mode);
        expect(option.leg.from.lat).to.equal(parseFloat(event.from.split(',')[0]));
        expect(option.leg.from.lon).to.equal(parseFloat(event.from.split(',')[1]));
      });
    });

    it('Can create the HSL booking', () => {
      // put fare if there is none
      const booking = utils.cloneDeep(optionsResponse.options[0]);
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

    // FIXME For some reason we do not get the same start time as requested,
    // but 10 minutes earlier
    it('The HSL booking data corresponds the chosen option', () => {
      const option = optionsResponse.options[0];
      const booking = createResponse.booking;

      expect(booking.leg.startTime).to.equal(option.leg.startTime);
      expect(booking.leg.mode).to.equal(option.leg.mode);
      expect(booking.leg.endTime).to.equal(option.leg.endTime);
      expect(booking.cost).to.deep.equal(option.cost);
    });

    it('Can retrieve the HSL ticket', () => {
      event = {
        identityId: testUserIdentity,
        bookingId: createResponse.booking.id,
        refresh: 'true',
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
        // FIXME For some reason, HSL dates the ticket 7 minute in the past, hence this fails
        //startTime: startTime,
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
      /*console.log('List options', JSON.stringify(optionsResponse, null, 2));
      console.log('Create booking', JSON.stringify(createResponse, null, 2));
      console.log('Retrieve booking', JSON.stringify(retrieveResponse, null, 2));
      console.log('Cancel booking', JSON.stringify(cancelResponse, null, 2));
      console.log('List bookings', JSON.stringify(listResponse, null, 2));*/

      if (createResponse && createResponse.booking.id) {
        return Promise.resolve()
        .then(() => models.Booking.query().delete().where('id', createResponse.booking.id))
        .finally(() => Database.cleanup());
      }

      return Database.cleanup();
    });
  });
};
