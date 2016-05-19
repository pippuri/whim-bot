
var Promise = require('bluebird');
var expect = require('chai').expect;
var moment = require('moment');

module.exports = function (engine) {

  describe('query for routes', function () {

    var principalId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    var event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
    };

    var calls = [];
    var response;

    var serviceBusDummy = {
      call: (serviceName) => new Promise((resolve, reject) => {
        calls.push(serviceName);
        if (serviceName === 'MaaS-database-context-get') {
          return resolve({ activePlans: ['plan1', 'plan2'] });
        }

        if (serviceName === 'MaaS-provider-tripgo-routes-southfinland') {
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

    var ruleObject = {
      rule: 'get-routes',
      identityId: principalId,
      parameters: event,
    };

    var options = {
      serviceBus: serviceBusDummy,
    };

    before(function (done) {
      engine.call(ruleObject, options)
      .then(data => {
        response = data;
        done();
      });
    });

    it('should call context and routes service', function () {
      expect(calls).to.deep.equal(['MaaS-database-context-get', 'MaaS-provider-tripgo-routes-southfinland']);
    });

    it('should return routes annotated with co2 cost for each leg', function () {
      var legsWithoutCo2Cost = [];
      response.plan.itineraries.forEach(itinerary => {
        itinerary.legs.forEach(leg => {
          if (leg.hasOwnProperty('fare') && leg.fare.hasOwnProperty('co2') && typeof leg.fare.co2 === typeof 123) {
            // no problem
          } else {
            legsWithoutCo2Cost.push(leg);
          }
        });
      });
      expect(legsWithoutCo2Cost).to.be.empty;
    });

  });
};
