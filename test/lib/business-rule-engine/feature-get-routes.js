
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
    var serviceBusDummy = {
      call: (serviceName) => new Promise((resolve, reject) => {
        calls.push(serviceName);
        if (serviceName === 'MaaS-database-context-get') {
          return resolve({ activePlans: ['plan1', 'plan2'] });
        }

        return resolve();
      }),
    };

    var ruleObject = {
      rule: 'get-routes',
      userId: principalId,
      parameters: event,
    };

    var options = {
      serviceBus: serviceBusDummy,
    };

    before(function (done) {
      engine.call(ruleObject, options)
      .then(() => {done();});
    });

    it('should call context and routes service', function () {
      expect(calls).to.deep.equal(['MaaS-database-context-get', 'MaaS-provider-tripgo-routes-southfinland']);
    });

  });
};
