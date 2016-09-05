'use strict';

const expect = require('chai').expect;
const moment = require('moment');
const bus = require('../../../lib/service-bus');

module.exports = () => {

  describe('unauthorized request', () => {

    const event = {
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office
        to: '60.170779,24.7721584', // Gallows Bird Pub
        leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
      },
      headers: {},
    };

    let error;
    let response;

    before(done => {
      bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        })
        .finally(() => {
          done();
          return;
        });
    });

    it('should raise an error', () => {
      expect(error).not.to.be.null;
    });

    it('should provide the expected error message', () => {
      expect(error.message).to.equal('Empty response / No item found with identityId undefined');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

  });

  describe('request without "from"', () => {
    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000', // test user
      payload: {
        to: '60.170779,24.7721584', // Gallows Bird Pub
        leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
      },
      headers: {},
    };

    let error;
    let response;

    before(done => {
      bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;

        })
        .catch(err => {
          error = err;

        })
        .finally(() => {
          done();
          return;
        });
    });

    it('should raise an error', () => {
      expect(error).not.to.be.null;
    });

    it('should provide the expected error message', () => {
      expect(error.message).to.equal('400: Missing "from" input');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

  });

  describe('request without "to"', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000', // test user
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office
        leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
      },
      headers: {},
    };

    let error;
    let response;

    before(done => {
      bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        })
        .finally(() => {
          done();
          return;
        });
    });

    it('should raise an error', () => {
      expect(error).not.to.be.null;
    });

    it('should provide the expected error message', () => {
      expect(error.message).to.equal('400: Missing "to" input');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

  });

  describe('request with both "leaveAt" and "arriveBy"', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000', // test user
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office
        to: '60.170779,24.7721584', // Gallows Bird Pub
        leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '' + moment().isoWeekday(8).hour(21).valueOf(), // Monday one week forward around nine
      },
      headers: {},
    };

    let error;
    let response;

    before(done => {
      bus.call('MaaS-routes-query', event)
        .then(res => {
          response = res;
        })
        .catch(err => {
          error = err;
        })
        .finally(() => {
          done();
          return;
        });
    });

    it('should raise an error', () => {
      expect(error).not.to.be.null;
    });

    it('should provide the expected error message', () => {
      expect(error.message).to.equal('400: Support only leaveAt or arriveBy, not both');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

  });
};
