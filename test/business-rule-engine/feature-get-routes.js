'use strict';

const expect = require('chai').expect;
const moment = require('moment');
const bus = require('../../lib/service-bus');
const Promise = require('bluebird');

// NOTE test library for this rule is not nessesary need to be extensive as many tests for routes-query has been written for routes-query API

module.exports = function () {

  describe('[POSITIVE] query for routes from Ludviginkatu to Aapelinkatu', () => {

    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    const event = {
      from: '60.1657520782836,24.9449517015989', // Ludviginkatu
      to: '60.15539,24.75017', // Aapelinkatu
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
    };

    let error;
    let response;

    before(() => {
      return Promise.all(
        [
          bus.call('MaaS-profile-info', {
            identityId,
          }),
          bus.call('MaaS-business-rule-engine', {
            identityId: identityId,
            rule: 'get-routes',
            parameters: event,
          }),
        ]
      )
      .spread((_profile, _engineResponse) => {
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

    it('all itineraries startTime must the same with first leg startTime', () => {
      response.plan.itineraries.forEach(itinerary => {
        expect(itinerary.startTime).to.equal(itinerary.legs[0].startTime);
      });
    });

    it('have 1 itinerary with SUBWAY, and its first leg startTime must equal itinerary startTime', () => {
      response.plan.itineraries.map(itinerary => itinerary.legs.map(leg => leg.mode));
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
          if (leg.agencyId === '') legWithEmptyAgencyId++;
        });
      });

      expect(legWithEmptyAgencyId).to.equal(0);
    });

    it('should call context and routes service', () => {
      // expect(calls).to.deep.equal(['MaaS-profile-info', 'MaaS-provider-tripgo-routes', 'MaaS-business-rule-engine']);
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

  });

};
