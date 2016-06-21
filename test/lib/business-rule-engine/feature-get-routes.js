'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const moment = require('moment');

module.exports = (engine) => {

  describe('query for routes', () => {

    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    const event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
    };

    const calls = [];
    let error;
    let response;

    const serviceBusDummy = {
      call: serviceName => new Promise((resolve, reject) => {
        calls.push(serviceName);
        if (serviceName === 'MaaS-profile-info') {
          return resolve({
            Item: {
              plan: [],
            },
          });
        }

        if (serviceName === 'MaaS-provider-tripgo-routes') {
          return resolve({
            plan: {
              itineraries: [
                {
                  legs: [
                    {
                      from: {
                        lat: 60.1684126,
                        lon: 24.9316739,
                      },
                      to: {
                        lat: 60.170779,
                        lon: 24.7721584,
                      },
                      mode: 'BUS',
                    },
                  ],
                },
              ],
            },
          });
        }

        return resolve();
      }),
    };

    const ruleObject = {
      rule: 'get-routes',
      identityId: identityId,
      parameters: event,
    };

    const options = {
      serviceBus: serviceBusDummy,
    };

    before(done => {
      engine.call(ruleObject, options)
      .then(data => {
        response = data;
        done();
      })
      .catch(err => {
        error = err;
        done();
      });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.undefined;
    });

    it('should call context and routes service', () => {
      expect(calls).to.deep.equal(['MaaS-profile-info', 'MaaS-provider-tripgo-routes']);
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
