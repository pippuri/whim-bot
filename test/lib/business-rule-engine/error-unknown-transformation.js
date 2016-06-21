'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const moment = require('moment');

module.exports = function (engine) {

  describe('unknown transformation', () => {

    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    const event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
    };

    const calls = [];
    let error;

    const serviceBusDummy = {
      call: serviceName => new Promise((resolve, reject) => {
        calls.push(serviceName);
        return resolve();
      }),
    };

    const ruleObject = {
      rule: 'get-something-that-does-not-exist',
      identityId: identityId,
      parameters: event,
    };

    const options = {
      serviceBus: serviceBusDummy,
    };

    before(done => {
      engine.call(ruleObject, options)
      .then(() => {
        done();
      })
      .catch(err => {
        error = err;
        done();
      });
    });

    it('should raise an error', () => {
      expect(error).to.not.be.undefined;
    });

    it('should not call any services', () => {
      expect(calls).to.deep.equal([]);
    });

  });
};
