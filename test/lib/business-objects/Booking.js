'use strict';

const Booking = require('../../../lib/business-objects/Booking');
const expect = require('chai').expect;
const optionsLambda = require('../../../bookings/bookings-agency-options/handler.js');
const Profile = require('../../../lib/business-objects/Profile');
const Promise = require('bluebird');
const proxyquire = require('proxyquire');
const Transaction = require('../../../lib/business-objects/Transaction');
const utils = require('../../../lib/utils');
const wrap = require('lambda-wrapper').wrap;

const models = require('../../../lib/models');
const Database = models.Database;

// helper to run Lambdas
function runLambda(lambda, event) {
  return new Promise((resolve, reject) => {
    wrap(lambda).run(event, (error, response) => {
      return (error) ? reject(error) : resolve(response);
    });
  });
}

describe('Booking', () => {

  const testUserIdentity = 'eu-west-1:00000000-cafe-cafe-cafe-000000000007';
  const startTime = Date.now() + 24 * 60 * 60 * 1000;

  let startingBalance;
  let savedBooking;

  before(() => {
    // fetch user data to get account starting balance
    return Database.init()
      .then(() => Profile.retrieve(testUserIdentity))
      .then(profile => (startingBalance = profile.balance));
  });

  it('Refunds if active booking gets cancelled by TSP', () => {

    const optionsEvent = {
      identityId: testUserIdentity,
      agencyId: 'Sixt',
      fromRadius: 40000,
      mode: 'CAR',
      startTime: startTime,
      endTime: startTime + 45 * 60 * 60 * 1000,
      from: '60.18948,24.97213',
    };

    return runLambda(optionsLambda, optionsEvent)
      .then(optionsResponse => {
        return Promise.resolve({
          identityId: testUserIdentity,
          payload: utils.cloneDeep(optionsResponse.options[0]),
        });
      })
      .then(createEvent => {
        const unsignedBooking = utils.without(createEvent.payload, ['signature']);
        const transaction = new Transaction(testUserIdentity);
        const transaction2 = new Transaction(testUserIdentity);
        return transaction.start()
          .then(() => Booking.create(unsignedBooking, testUserIdentity, transaction))
          .then(booking => booking.pay(transaction))
          .then(booking => booking.reserve(transaction))
          .then(booking => transaction.commit('Bookings test; purchased Sixt rental')
            .then(() => Promise.resolve(booking)))
          .then(booking => {
            savedBooking = booking;
            expect(booking.state).to.equal('RESERVED');
            return Profile.retrieve(testUserIdentity)
              .then(profile => {
                expect(profile.balance).to.equal(startingBalance - booking.fare.amount);
                return Promise.resolve(booking);
              });
          })
          .then(booking => transaction2.start().then(() => Promise.resolve(booking)))
          .then(booking => {
            // Mock 'get' query to TSP to return cancelled state
            const BookingMock = proxyquire('../../../lib/business-objects/Booking', {
              'request-promise-lite': {
                get: (url, options) => {
                  return Promise.resolve({
                    tspId: booking.tspId,
                    state: 'CANCELLED',
                  });
                },
                '@global': true,
              },
            });
            return BookingMock.retrieve(booking.id, transaction2)
              .then(booking => Promise.resolve(savedBooking = booking));
          })
          .then(booking => booking.refresh(transaction2))
          .then(booking => transaction2.commit().then(() => Promise.resolve(booking)))
          .then(booking => {
            expect(booking.state).to.equal('CANCELLED');
            return Profile.retrieve(testUserIdentity)
              .then(profile => {
                expect(profile.balance).to.equal(startingBalance);
                return Promise.resolve(booking);
              });
          });
      });
  });

  after(() => {
    if (savedBooking) {
      // Call properly cancel once more to really cancel from Sixt
      savedBooking.booking.state = 'RESERVED';
      const transaction3 = new Transaction(testUserIdentity);
      return transaction3.start()
        .then(() => savedBooking.cancel(transaction3))
        .then(() => transaction3.commit())
        .then(() => models.Booking.query().delete().where('id', savedBooking.id))
        .finally(() => Database.cleanup());
    }

    return Database.cleanup();
  });

});
