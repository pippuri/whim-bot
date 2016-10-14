'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const schema = require('maas-schemas/prebuilt/maas-backend/profile/profile-info/response.json');
const validator = require('../../../lib/validator/index');

module.exports = function (lambda) {

  describe('query for an existing user', () => {

    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
    const event = {
      identityId: identityId,
    };

    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should return response and not raise an error', () => {
      expect(response).to.not.be.null;
      expect(error).to.be.null;
    });

    xit('should return a valid response', () => {
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });

    });

    it(`should return a profile with identityId ${identityId}`, () => {
      expect(response.profile).to.be.an('object');
      expect(response.profile).to.have.property('identityId');
      expect(response.profile.identityId).to.be.a('string');
      expect(response.profile.identityId).to.equal(identityId);
    });

  });
};
