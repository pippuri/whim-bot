'use strict';

const expect = require('chai').expect;
const moment = require('moment-timezone');
const bus = require('../../../lib/service-bus');
const MaaSError = require('../../../lib/errors/MaaSError');

module.exports = () => {

  describe('unauthorized request', () => {

    const event = {
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office
        to: '60.170779,24.7721584', // Gallows Bird Pub
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
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

    it('should provide the expected error', () => {
      expect(error).to.be.an.instanceof(MaaSError);
      expect(error.code).to.equal(500);
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
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
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
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
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
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
        arriveBy: '' + moment().tz('Europe/Helsinki').day(8).hour(21).valueOf(), // Monday one week forward around nine
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

  describe('Bad Origin name replacement with "fromName"', () => {
    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office
        to: '60.170779,24.7721584', // Gallows Bird Pub
        // Monday one week forward around five
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(),
        fromName: '--badName',
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
      expect(error).not.to.be.undefined;
    });

    it('should provide the expected error message', () => {
      expect(error.message).to.equal('400: Origin name supports only words, digits and spaces');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });
  });

  describe('Bad Destination name replacement with "toName"', () => {
    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        from: '60.1684126,24.9316739', // SC5 Office
        to: '60.170779,24.7721584', // Gallows Bird Pub
        // Monday one week forward around five
        leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(),
        toName: '````waaaass\\',
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
      expect(error).not.to.be.undefined;
    });

    it('should provide the expected error message', () => {
      expect(error.message).to.equal('400: Destination name supports only words, digits and spaces');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });
  });

};
