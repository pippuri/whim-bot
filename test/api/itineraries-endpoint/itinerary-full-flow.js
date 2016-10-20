'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const moment = require('moment');
const models = require('../../../lib/models');
const utils = require('../../../lib/utils');
const Profile = require('../../../lib/business-objects/Profile');
const Database = models.Database;

const routesQueryLambda = require('../../../routes/routes-query/handler');
const itineraryCreateLambda = require('../../../itineraries/itinerary-create/handler');
const itineraryRetrieveLambda = require('../../../itineraries/itinerary-retrieve/handler');
const itineraryListLambda = require('../../../itineraries/itinerary-list/handler');
const itineraryCancelLambda = require('../../../itineraries/itinerary-cancel/handler');

function runLambda(lambda, event) {
  return new Promise((resolve, reject) => {
    wrap(lambda).run(event, (error, response) => {
      return (error) ? reject(error) : resolve(response);
    });
  });
}

module.exports = function (input, results) {
  let queriedItinerary;
  let createdItinerary;
  let retrievedItinerary;
  let paidItineraries;
  let cancelledItinerary;

  let startingBalance;
  let midBalance;
  let endBalance;

  // Dynamic control flag: toggle true in the beginning of a suite,
  // put back to false if the previous phase ran ok.
  let skip = false;

  before(() => Database.init());

  describe('Queries for routes', () => {
    // Skip this part of the suite if skip flag has been raised
    before(function () {
      if (skip) {
        this.skip();
      }
      skip = true;
    });

    let itineraries;
    const event = utils.cloneDeep(input.event);

    // Move leaveAt week to match a date in the future (this or next week)
    const original = moment(parseFloat(event.payload.leaveAt));
    const leaveAt = moment(original);
    const now = moment().utcOffset(180);
    leaveAt.year(now.year());
    leaveAt.week(now.week());
    if (now.day() >= leaveAt.day()) {
      leaveAt.week(now.week() + 1);
    }
    event.payload.leaveAt = `${leaveAt.valueOf()}`;

    it(`Queries a route leaving at '${leaveAt.format('DD.MM.YYYY, HH:mm:ss Z')}'`, () => {
      return runLambda(routesQueryLambda, event)
        .then(
          response => {
            //console.log(`${response.plan.itineraries.length} routes found.`);
            return Promise.resolve(itineraries = response.plan.itineraries);
          },
          _error => {
            console.error(`Caught an error: ${_error.message}`);
            console.error(`Event: ${JSON.stringify(event, null, 2)}`);
            console.error(_error.stack);
            return Promise.reject(_error);
          }
        );
    });

    it(`Finds at least one itinerary with agencies '${input.filter.agencies}', modes '${input.filter.modes}'`, () => {
      return new Promise((resolve, reject) => {
        // JSON data does not support 'undefined', which is encoded in test data as 'null'
        const modes = input.filter.modes;
        const agencies = (input.filter.agencies) ? input.filter.agencies.map(agency => {
          return (agency === null) ? undefined : agency;
        }) : undefined;

        // Filter out the legs to determine if the itinerary has only valid legs
        const filtered = itineraries.filter(itinerary => {
          // If filters are specified, apply them
          const filtered = itinerary.legs
            .filter(leg => {
              const found = (modes ? modes.some(mode => mode === leg.mode) : true);
              if (!found) {
                //console.log(`Filtering out leg, unmatched mode ${leg.mode} for leg`);
              }
              return found;
            })
            .filter(leg => {
              const found = (agencies ? agencies.some(agencyId => agencyId === leg.agencyId) : true);
              if (!found) {
                //console.log(`Filtering out leg, unmatched agencyId ${leg.agencyId}`);
              }
              return found;
            });

          // The itinerary is valid if all the legs passed the filters
          return filtered.length === itinerary.legs.length;
        });

        // Assume at least one matching itinerary; save it
        //console.log(`${filtered.length} routes with with agencies '${input.filter.agencies}', modes '${input.filter.modes}'.`);
        expect(filtered).to.not.be.empty;
        queriedItinerary = filtered[0];

        skip = false;
        return resolve(queriedItinerary);
      });
    });
  });

  describe('Creates an itinerary', () => {
    // Skip this part of the suite if skip flag has been raised
    before(() => {
      if (skip) {
        this.skip();
      }
      skip = true;

      // fetch user data to get account starting balance
      return Profile.retrieve(input.event.identityId)
        .then(profile => (startingBalance = profile.balance));
    });

    it(`Creates an itinerary for user '${input.event.identityId}'`, () => {
      const event = {
        identityId: input.event.identityId,
        itinerary: utils.cloneDeep(queriedItinerary),
      };

      return runLambda(itineraryCreateLambda, event)
        .then(
          response => {
            //console.log(`Created itinerary with an id '${response.itinerary.id}'.`);
            return Promise.resolve(createdItinerary = response.itinerary);
          },
          _error => {
            console.log(`Caught an error: ${_error.message}`);
            console.log(`Event: ${JSON.stringify(event, null, 2)}`);
            console.log(_error.stack);
            return Promise.reject(_error);
          }
        )
        .then(createdItinerary => {
          // Fetch user data to get account current balance
          return Profile.retrieve(input.event.identityId)
            .then(profile => (midBalance = profile.balance))
            .then(() => createdItinerary);
        });
    });

    it('Creates the itinerary in \'PAID\' state', () => {
      expect(createdItinerary.state).to.equal('PAID');
    });

    it('Creates bookings for legs that are bookable', () => {
      // Check that each bookable leg is actually booked
      createdItinerary.legs.forEach(leg => {
        const bookableAgencies = input.filter.bookable || [];
        if (bookableAgencies.some(agencyId => agencyId === leg.agencyId)) {
          expect(leg.booking).to.be.an('object');
          expect(leg.booking.state).to.be.oneOf(['PAID', 'RESERVED', 'CONFIRMED']);
        }
      });
    });

    it('Does not create bookings for legs that are not bookable', () => {
      // Check that there are no bookings for legs that are not bookable
      createdItinerary.legs.forEach(leg => {
        const bookableAgencies = input.filter.bookable || [];

        if (!bookableAgencies.some(agencyId => agencyId === leg.agencyId)) {
          expect(leg.booking).to.be.undefined;
        }
      });
    });

    it('Creates the itinerary, legs as PAID', () => {
      expect(createdItinerary.state).to.equal('PAID');
      // Check each bookable leg is actually booked
      createdItinerary.legs.forEach(leg => {
        expect(leg.state).to.equal('PAID');
      });

      skip = false;
    });

    it('User balance is reduced by fare', () => {
      expect(startingBalance - (createdItinerary.fare.points || 0)).to.equal(midBalance);
    });

  });

  describe('Retrieves the itinerary', () => {
    // Skip this part of the suite if skip flag has been raised
    before(function () {
      if (skip) {
        this.skip();
      }
      skip = true;
    });

    it('Retrieves the itinerary', () => {
      const event = {
        identityId: input.event.identityId,
        itineraryId: createdItinerary.id,
      };

      return runLambda(itineraryRetrieveLambda, event)
        .then(
          response => Promise.resolve(retrievedItinerary = response.itinerary),
          _error => {
            console.log(`Caught an error: ${_error.message}`);
            console.log(`Event: ${JSON.stringify(event, null, 2)}`);
            console.log(_error.stack);
            return Promise.reject(_error);
          }
        );
    });

    it('Retrieves the itinerary & legs in PAID state, bookings in PAID, RESERVED or CONFIRMED state', () => {
      expect(retrievedItinerary.state).to.equal('PAID');
      retrievedItinerary.legs.forEach(leg => {
        expect(leg.state).to.equal('PAID');
        if (leg.booking) {
          expect(leg.booking.state).to.be.oneOf(['PAID', 'RESERVED', 'CONFIRMED']);
        }
      });

      skip = false;
    });
  });

  describe('Lists itineraries', () => {
    // Skip this part of the suite if skip flag has been raised
    before(function () {
      if (skip) {
        this.skip();
      }
      skip = true;
    });

    it('Lists the itineraries that are \'PAID\'', () => {
      const event = {
        identityId: input.event.identityId,
        states: 'PAID',
      };

      return runLambda(itineraryListLambda, event)
        .then(
          response => Promise.resolve(paidItineraries = response.itineraries),
          _error => {
            console.log(`Caught an error: ${_error.message}`);
            console.log(`Event: ${JSON.stringify(event, null, 2)}`);
            console.log(_error.stack);
            return Promise.reject(_error);
          }
        );
    });

    it('Finds the created itinerary in the list', () => {
      const itinerary = paidItineraries.find(itinerary => {
        return itinerary.id === createdItinerary.id;
      });

      expect(itinerary).to.exist;
      skip = false;
    });
  });

  describe('Cancels the itinerary', () => {
    // Skip this part of the suite if skip flag has been raised
    before(function () {
      if (skip) {
        this.skip();
      }
      skip = true;
    });

    it('Cancels the created itinerary', () => {
      const event = {
        identityId: input.event.identityId,
        itineraryId: createdItinerary.id,
      };

      return runLambda(itineraryCancelLambda, event)
        .then(
          response => Promise.resolve(cancelledItinerary = response.itinerary),
          _error => {
            console.log(`Caught an error: ${_error.message}`);
            console.log(`Event: ${JSON.stringify(event, null, 2)}`);
            console.log(_error.stack);
            return Promise.reject(_error);
          }
        )
        .then(cancelledItinerary => {
          // fetch user data to get account starting balance
          return Profile.retrieve(input.event.identityId)
            .then(profile => (endBalance = profile.balance))
            .then(() => Promise.resolve(cancelledItinerary));
        });

    });

    it('Cancelled itinerary has \'CANCELLED\' or \'CANCELLED_WITH_ERRORS\' state', () => {
      // FIXME When the implementation is in, accept CANCELLED_WITH_ERRORS only for legs
      // of which bookings are CONFIRMED (=cannot be cancelled anymore)
      expect(cancelledItinerary.state).to.be.oneOf(['CANCELLED', 'CANCELLED_WITH_ERRORS']);
      cancelledItinerary.legs.forEach(leg => {
        if (leg.booking) {
          if (leg.booking.state === 'CONFIRMED') {
            expect(leg.state).to.be.oneOf(['CANCELLED_WITH_ERRORS']);
          } else {
            expect(leg.state).to.be.oneOf(['CANCELLED']);
            expect(leg.booking.state).to.be.oneOf(['CANCELLED']);
          }
        } else {
          expect(leg.state).to.be.oneOf(['CANCELLED']);
        }
      });

      skip = false;
    });

    it('Fare is refunded if clean cancel', () => {
      if (cancelledItinerary.state === 'CANCELLED') {
        expect(startingBalance).to.equal(endBalance);
      } else {
        expect(startingBalance - (cancelledItinerary.fare.points || 0)).to.equal(endBalance);
      }
    });

  });

  after(() => {
    if (!createdItinerary) {
      //console.log('No itinerary created within flow, nothing to cleanup.');
      return Promise.resolve();
    }

    // Cleanup legs with their bookings; then remove the itinerary, too
    const itineraryId = createdItinerary.id;
    //console.log(`Deleting itinerary '${itineraryId}' with ${createdItinerary.legs.length} legs`);
    return Promise.map(createdItinerary.legs, leg => {
      const legId = leg.id;
      const bookingId = (leg.booking) ? leg.booking.id : null;

      return models.Leg.query().delete().where('id', legId)
        .then(() => {
          return ((leg.booking) ? models.Booking.query().delete().where('id', bookingId) : null);
        });
    })
    .then(() => {
      return models.Itinerary.query().delete().where('id', itineraryId);
    })
    .finally(() => {
      return Database.cleanup();
    });
  });
};
