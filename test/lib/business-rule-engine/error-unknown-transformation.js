
var Promise = require('bluebird');
var expect = require('chai').expect;
var moment = require('moment');

module.exports = function (engine) {

  describe('unknown transformation', function () {

    var principalId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    var event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
    };

    var calls = [];
    var error;

    var serviceBusDummy = {
      call: (serviceName) => new Promise((resolve, reject) => {
        calls.push(serviceName);
        return resolve();
      }),
    };

    var ruleObject = {
      rule: 'get-something-that-does-not-exist',
      userId: principalId,
      parameters: event,
    };

    var options = {
      serviceBus: serviceBusDummy,
    };

    before(function (done) {
      engine.call(ruleObject, options)
      .then(() => {
        done();
      })
      .catch((err) => {
        error = err;
        done();
      });
    });

    it('should raise an error', function () {
      expect(error).to.not.be.undefined;
    });

    it('should not call any services', function () {
      expect(calls).to.deep.equal([]);
    });

  });
};
