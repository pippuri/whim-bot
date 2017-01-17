'use strict';

const expect = require('chai').expect;
const bus = require('../../../lib/service-bus');
const testCases = require('./fixture-test-cases.js');

module.exports = () => {
  testCases.forEach(testCase => {
    describe(`[POSITIVE] query for routes from ${testCase.fromName} to ${testCase.toName}`, () => {
      let error;
      let response;

      before(function () {
        if (testCase.skip === true) this.skip();
        return bus.call('MaaS-routes-query', {
          identityId: testCase.identityId,
          payload: testCase.payload,
        })
        .then(_engineResponse => {
          response = _engineResponse;
        })
        .catch(err => {
          error = err;
        });
      });

      it('should succeed without errors', () => {
        expect(error).to.be.undefined;
      });

      it('should return a valid response', () => {
        expect(response).to.not.be.undefined;
        expect(response.plan).to.not.be.undefined;
        expect(response.plan.itineraries).to.not.be.undefined;
        expect(response.plan.itineraries).to.be.an('array');
      });

      it('all itineraries startTime must the same with its first leg startTime', () => {
        response.plan.itineraries.forEach(itinerary => {
          expect(itinerary.startTime).to.equal(itinerary.legs[0].startTime);
        });
      });

      testCase.minimumModes.forEach(mode => {
        it(`have at least 1 itinerary with ${mode}`, () => {
          const itineraryWithMode = response.plan.itineraries.filter(itinerary => {
            return itinerary.legs.some(leg => leg.mode ===  mode);
          });
          expect(itineraryWithMode).to.have.length.least(1);
        });
      });

      it('all itineraries should not have connected WALKING legs', () => {

        let haveConnectedWalkingLeg = false;

        response.plan.itineraries.forEach(itinerary => {
          for (let i = 0; i < itinerary.legs.length - 1; i++) {
            if (itinerary.legs[i].mode === 'WALK' && itinerary.legs[i + 1].mode === 'WALK') {
              haveConnectedWalkingLeg = true;
              break;
            }
          }
        });

        expect(haveConnectedWalkingLeg).to.be.false;
      });

      it('all itineraries should not have empty agencyId', () => {

        let legWithEmptyAgencyId = 0;

        response.plan.itineraries.forEach(itinerary => {
          itinerary.legs.forEach(leg => {
            if (['WALK', 'WAIT', 'TRANSFER', 'BICYCLE'].indexOf(leg.mode) === -1) {
              if (!leg.agencyId === '') legWithEmptyAgencyId++;
            }
          });
        });

        expect(legWithEmptyAgencyId).to.equal(0);
      });

      it('should return routes annotated with co2 cost for each itinerary', () => {
        const itinerariesWithoutCo2Cost = [];
        for (let itinerary of response.plan.itineraries) { // eslint-disable-line prefer-const
          if (itinerary.hasOwnProperty('fare') && itinerary.fare.hasOwnProperty('co2') && typeof itinerary.fare.co2 === typeof 123) {
            // no problem
          } else {
            itinerariesWithoutCo2Cost.push(itinerary);
          }

        }

        expect(itinerariesWithoutCo2Cost).to.be.empty;
      });

      it('should return null costs for itinerary that is unbookable', () => {
        const purchasableProvider = Object.keys(require('../../../lib/tsp/tspData-dev.json'));
        const unbookableItineraries = [];

        response.plan.itineraries.forEach(itinerary => {
          itinerary.legs.forEach(leg => {
            // If leg doesn't have an agencyId and is not a WALK / WAIT / TRANSFER leg, make itinerary unpurchasable
            if (leg.hasOwnProperty('agencyId') && (['WALK', 'WAIT', 'TRANSFER', 'BICYCLE'].indexOf(leg.mode) === -1) && purchasableProvider.indexOf(leg.agencyId) === -1) {
              unbookableItineraries.push(itinerary);
            }

            if (!leg.hasOwnProperty('agencyId') && (['WALK', 'WAIT', 'TRANSFER', 'BICYCLE'].indexOf(leg.mode) === -1)) {
              unbookableItineraries.push(itinerary);
            }
          });
        });
        expect(unbookableItineraries.map(itinerary => itinerary.fare.points).every(cost => cost === null)).to.be.true;
      });

      it('sum of legs fare must be equal to itinerary fare (if not null)', () => {
        response.plan.itineraries.forEach(itinerary => {
          if (itinerary.fare.points !== null) {
            let legFareSum = 0;
            itinerary.legs.forEach(leg => {
              if (leg.fare.amount === null) {
                legFareSum += 0;
              } else {
                legFareSum += leg.fare.amount;
              }
            });

            expect(legFareSum).to.equal(itinerary.fare.points);
          }
        });
      });

    });
  });
};
