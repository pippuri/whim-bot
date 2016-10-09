'use strict';

const bus = require('../../lib/service-bus/');
const moment = require('moment');
const expect = require('chai').expect;
const mockProfiles = require('../../lib/service-bus/mockDynamoProfiles.json');

module.exports = function () {

  // Monday 10.10 17:00 to be moved to monday next week
  const leaveAt = moment(1476108000000);
  const now = moment().utcOffset(120);
  leaveAt.year(now.year());
  leaveAt.week(now.week());
  if (now.day() >= leaveAt.day()) {
    leaveAt.week(now.week() + 1);
  }

  describe(`Pricing for different planlevels from Ludviginkatu to Kilonrinne at '${leaveAt.format('DD.MM.YYYY, HH:mm:ss Z')}'}`, () => {

    // Last digit coresponds to the userlevel
    const usersIdentityIds = [
      'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      'eu-west-1:00000000-cafe-cafe-cafe-000000000001',
      'eu-west-1:00000000-cafe-cafe-cafe-000000000002',
      'eu-west-1:00000000-cafe-cafe-cafe-000000000003',
    ];

    const response = [];
    const error = [];

    before(() => {
      return Promise.all(usersIdentityIds.map((identityId, index) => {
        const params = {
          from: '60.1657520782836,24.9449517015989', // Ludviginkatu
          to: '60.220307,24.7752453', // Kilonrinne
          leaveAt: `${leaveAt.valueOf()}`,
        };

        return bus.call('MaaS-business-rule-engine', {
          identityId: identityId,
          rule: 'get-routes',
          parameters: params,
        })
        .then(res => {
          response[index] = res;
        })
        .catch(err => {
          error[index] = err;
        });
      }));
    });

    usersIdentityIds.forEach((identityId, index) => {
      // Get plan level by the last character
      const planlevel = Number(identityId.charAt(identityId.length - 1));
      const publicTransits = ['TRAIN', 'BUS', 'TRAM', 'SUBWAY'];
      const privateTransits = ['CAR', 'TAXI'];
      const freeModes = ['WAIT', 'TRANSFER', 'WALK'];
      const transitModes = publicTransits.concat(privateTransits);

      it('planlevel should be a positive number', () => {
        expect(planlevel).to.be.least(0);
      });

      it(`should return a response without error for user with planlevel ${planlevel}`, () => {
        if (error[index]) {
          console.log('Caught an error:', error[index].message);
          console.log(error[index].stack);
        }

        expect(response[index]).to.not.be.undefined;
        expect(error[index]).to.be.undefined;
      });

      if (planlevel === 0) {
        it(`planlevel ${planlevel} user should not have any free transits`, () => {
          const itineraries = response[index].plan.itineraries;

          const itinerariesWithTransits = itineraries.filter(iti => {
            return iti.legs.some(leg => transitModes.some(mode => leg.mode === mode));
          });

          expect(itinerariesWithTransits.length).to.be.above(0);
          itinerariesWithTransits.forEach(itinerary => {
            expect(itinerary.fare.points).to.be.above(0);
          });
        });
        return;
      }

      it(`planlevel ${planlevel} user should have one or more free HSL itinerary`, () => {
        const matchedProfile = mockProfiles.find(profile => profile.planlevel === planlevel);
        const itineraries = response[index].plan.itineraries;
        const freeFeatures = matchedProfile.plans
          .map(plan => plan.feature)                     // Pick features of each
          .reduce((arr1, arr2) => arr1.concat(arr2), []) // Combine the arrays
          .map(feature => feature.name.toUpperCase());   // Pick 'name' property

        const freeItineraries = itineraries.filter(iti => {
          const featuredLegs = iti.legs.filter(leg => {
            return freeFeatures.some(feature => {
              // Cast to string for comparison
              return feature === `${leg.agencyId}`.toUpperCase();
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
        /*console.log(freeItineraries.map(i => {
          return {
            agencies: i.legs.map(l => l.agencyId),
            fare: i.fare.points,
          };
        }));*/

        expect(freeItineraries.length).to.be.above(0);
        freeItineraries.forEach(itinerary => {
          expect(itinerary.fare.points).to.equal(0);
        });
      });
    });
  });
};
