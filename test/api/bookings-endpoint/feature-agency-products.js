'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const schema = require('maas-schemas/prebuilt/maas-backend/bookings/bookings-agency-products/response.json');
const validator = require('../../../lib/validator');
const moment = require('moment-timezone');

module.exports = function (lambda) {
  const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000002';

  describe('request agency products for Whim car provided by Sixt', () => {
    let error;
    let response;

    const validEvent = {
      identityId: testIdentityId,
      agencyId: 'Sixt-Whim-car',
    };

    before(done => {
      wrap(lambda).run(validEvent, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should trigger a valid response', () => {
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('should succeed without error', () => {
      expect(error).to.be.null;
    });
  });

  describe('request agency products for Sixt', () => {
    let error;
    let response;

    const faultyEvent = {
      identityId: testIdentityId,
      agencyId: 'Sixt',
    };

    before(done => {
      wrap(lambda).run(faultyEvent, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

    it('should fail with an errorMessage', () => {
      expect(error).to.exist;
    });
  });
};
