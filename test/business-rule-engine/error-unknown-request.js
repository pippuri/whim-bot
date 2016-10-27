'use strict';

const expect = require('chai').expect;
const moment = require('moment-timezone');
const bus = require('../../lib/service-bus');

module.exports = function () {

  describe('[NEGATIVE] Unknown request', () => {

    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    const event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
    };

    const calls = [];
    let error;
    let response;

    before(() => {
      return bus.call('MaaS-business-rule-engine', {
        identityId: identityId,
        rule: 'get-something-that-does-not-exist',
        parameters: event,
      })
      .then(res => {
        response = res;
      })
      .catch(err => {
        error = err;
      });
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

    it('should raise an error', () => {
      expect(error).to.not.be.undefined;
    });

    it('should not call any services', () => {
      expect(calls).to.deep.equal([]);
    });

  });
};
