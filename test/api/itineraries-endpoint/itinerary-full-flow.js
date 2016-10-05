'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const moment = require('moment');
const models = require('../../../lib/models');
const utils = require('../../../lib/utils');
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

  // Dynamic control flag: toggle true in the beginning of a suite,
  // put back to false if the previous phase ran ok.
  let skip = false;

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
    const now = moment().utcOffset(120);
    leaveAt.year(now.year());
    leaveAt.week(now.week());
    if (now.day() >= leaveAt.day()) {
      leaveAt.week(now.week() + 1);
    }
    event.payload.leaveAt = `${leaveAt.valueOf()}`;

    it(`Queries a route leaving at '${leaveAt.format('DD.MM.YYYY, HH:mm:ss')}'`, () => {
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
    before(function () {
      if (skip) {
        this.skip();
      }
      skip = true;
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
        );
    });

    it('Creates the itinerary in \'PAID\' state', () => {
      // FIXME Change this when jubilem's new work is in
      //expect(createdItinerary.state).to.equal('PAID');
      expect(createdItinerary.state).to.equal('ACTIVATED');
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
      // FIXME Change this when jubilem's new work is in
      //expect(createdItinerary.state).to.equal('PAID');
      expect(createdItinerary.state).to.equal('ACTIVATED');

      // Check each bookable leg is actually booked
      createdItinerary.legs.forEach(leg => {
        // FIXME Change this when jubilem's new work is in
        //expect(leg.state).to.equal('PAID');
        expect(leg.state).to.equal('ACTIVATED');
      });

      skip = false;
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
      // FIXME Change this when jubilem's new work is in
      //expect(retrievedItinerary.state).to.equal('PAID');
      expect(retrievedItinerary.state).to.equal('ACTIVATED');
      retrievedItinerary.legs.forEach(leg => {
        // FIXME Change this when jubilem's new work is in
        //expect(leg.state).to.equal('PAID');
        expect(leg.state).to.equal('ACTIVATED');
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
        // FIXME Change this when jubilem's new work is in
        //states: 'PAID',
        states: 'ACTIVATED',
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
        );
    });

    it('Cancelled itinerary has \'CANCELLED\' or \'CANCELLED_WITH_ERRORS\' state', () => {
      // FIXME When the implementation is in, accept CANCELLED_WITH_ERRORS only for legs
      // of which bookings are CONFIRMED (=cannot be cancelled anymore)
      //expect(cancelledItinerary.state).to.equal('CANCELLED');
      expect(cancelledItinerary.state).to.be.oneOf(['CANCELLED', 'CANCELLED_WITH_ERRORS']);
      cancelledItinerary.legs.forEach(leg => {
        expect(leg.state).to.be.oneOf(['CANCELLED', 'CANCELLED_WITH_ERRORS']);
        if (leg.booking) {
          expect(leg.booking.state).to.be.oneOf(['CANCELLED', 'CANCELLED_WITH_ERRORS']);
        }
      });

      skip = false;
    });
  });

  after(() => {
    return Database.init()
      .then(() => {
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
          return Promise.all([
            models.Leg.query().delete().where('id', legId),
            ((leg.booking) ? models.Booking.query().delete().where('id', bookingId) : null),
          ]);
        })
        .then(() => {
          return models.Itinerary.query().delete().where('id', itineraryId);
        })
        .finally(() => {
          return Database.cleanup();
        });
      });
  });
};
