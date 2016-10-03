'use strict';

const bus = require('../../lib/service-bus/');
const moment = require('moment');
const expect = require('chai').expect;
const mockProfiles = require('../../lib/service-bus/mockDynamoProfiles.json');

module.exports = function () {

  describe('Pricing for different planlevel', () => {

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
          leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
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
      const transitModes = publicTransits.concat(privateTransits);

      it('planlevel should be a positive number', () => {
        expect(planlevel).to.be.least(0);
      });

      it(`should return a response without error for user with planlevel ${planlevel}`, () => {
        expect(response[index]).to.not.be.undefined;
        expect(error[index]).to.be.undefined;
      });

      if (planlevel === 0) {
        it(`planlevel ${planlevel} user should not have any free ticket for transits itinerary`, () => {
          const itineraryWithTransits = response[index].plan.itineraries.filter(iti => iti.legs.some(leg => transitModes.indexOf(leg.mode) !== -1));
          expect(itineraryWithTransits.map(itinerary => itinerary.fare.points).every(cost => cost !== 0)).to.be.true;

        });
      } else if (planlevel > 0) {
        const matchedProfile = mockProfiles.find(profile => profile.planlevel === planlevel && profile.identityId === identityId);

        it(`planlevel ${planlevel} user should have free ticket for the providers listed in his plan feature`, () => {
          const freeItinerary = response[index].plan.itineraries.filter(iti => iti.legs.every(leg => {
            if (!leg.agencyId) return true;
            return matchedProfile.plans.some(plan => plan.feature.map(fea => fea.name.toUpperCase()).indexOf(leg.agencyId.toUpperCase()) !== -1);
          }));
          expect(freeItinerary.map(iti => iti.fare.points).every(cost => cost === 0)).to.be.true;
        });
      }

    });
  });
};
