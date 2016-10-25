'use strict';

const bus = require('../../lib/service-bus/');
const moment = require('moment');
const expect = require('chai').expect;
const allProfiles = require('../db/profiles-seed.json');

module.exports = function () {

  const profiles = allProfiles.filter(profile => {
    return [
      'eu-west-1:00000000-cafe-cafe-cafe-000000000001', // fi-whim-light
      'eu-west-1:00000000-cafe-cafe-cafe-000000000002', // fi-whim-medium
      'eu-west-1:00000000-cafe-cafe-cafe-000000000003', // fi-whim-premium
      'eu-west-1:00000000-cafe-cafe-cafe-000000000004', // fi-whim-payg
    ].some(identityId => identityId === profile.identityId);
  });

  // Monday 10.10 17:00 to be moved to monday next week
  const leaveAt = moment(1476108000000);
  const now = moment().utcOffset(120);
  leaveAt.year(now.year());
  leaveAt.week(now.week());
  if (now.day() >= leaveAt.day()) {
    leaveAt.week(now.week() + 1);
  }

  describe(`Pricing for different subscriptions from Ludviginkatu to Kilonrinne at '${leaveAt.format('DD.MM.YYYY, HH:mm:ss Z')}'}`, () => {
    const responses = {};
    const errors = {};

    before(() => {
      return Promise.all(profiles.map((profile, index) => {
        const params = {
          from: '60.1657520782836,24.9449517015989', // Ludviginkatu
          to: '60.220307,24.7752453', // Kilonrinne
          leaveAt: `${leaveAt.valueOf()}`,
        };

        return bus.call('MaaS-business-rule-engine', {
          identityId: profile.identityId,
          rule: 'get-routes',
          parameters: params,
        })
        .then(
          res => (responses[index] = res),
          err => (errors[index] = err)
        );
      }));
    });

    profiles.forEach((profile, index) => {
      // Get plan level by the last character
      const planId = profile.subscription.planId;
      const publicTransits = ['TRAIN', 'BUS', 'TRAM', 'SUBWAY'];
      const privateTransits = ['CAR', 'TAXI'];
      const freeModes = ['WAIT', 'TRANSFER', 'WALK'];
      const transitModes = publicTransits.concat(privateTransits);

      it('planId should be a string', () => {
        expect(planId).to.be.a.string;
      });

      it(`should return a response without error for user with planId ${planId}`, () => {
        if (errors[index]) {
          console.log('Caught an error:', errors[index].message);
          console.log(errors[index].stack);
        }

        expect(responses[index]).to.not.be.undefined;
        expect(errors[index]).to.be.undefined;
      });

      if (planId === 'fi-whim-payg') {
        it(`user ${profile.identityId}, planId ${planId} user should not have any free transits`, () => {
          const itineraries = responses[index].plan.itineraries;

          const itinerariesWithTransits = itineraries.filter(iti => {
            return iti.legs.some(leg => transitModes.some(mode => leg.mode === mode));
          });

          expect(itinerariesWithTransits.length).to.be.above(0);
          itinerariesWithTransits.forEach(itinerary => {
            expect(itinerary.fare.points).to.satisfy(num => {
              return ((Number(num) === num && num > 0) || num === null);
            });
          });
        });
        return;
      }

      it(`user ${profile.identityId}, planId ${planId} user should have one or more free HSL itinerary`, () => {
        const itineraries = responses[index].plan.itineraries;
        const freeAgencies = profile.subscription.agencies;
        const freeItineraries = itineraries.filter(iti => {
          const featuredLegs = iti.legs.filter(leg => {
            return freeAgencies.some(agency => {
              // Cast to string for comparison
              return agency === `${leg.agencyId}`.toUpperCase();
            });
          });

          const freeLegs = iti.legs.filter(leg => {
            // Accept either free mode legs or agencyIds included in plan
            return freeModes.some(mode => mode === leg.mode);
          });

          // Exclude walking only etc. normally free itineraries
          if (freeLegs.length === iti.legs.length) {
            return false;
          }

          // Exclude itineraries that contain sth else than featured or free legs
          if (freeLegs.length + featuredLegs.length !== iti.legs.length) {
            return false;
          }

          return true;
        });

        expect(freeItineraries.length).to.be.above(0);
        freeItineraries.forEach(itinerary => {
          expect(itinerary.fare.points).to.equal(0);
        });
      });
    });
  });
};
