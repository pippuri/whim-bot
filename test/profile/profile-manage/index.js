'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-manage/handler.js');

module.exports = function () {

  describe('profile-manage', function () { //eslint-disable-line
    this.timeout(10000);
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

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.have.deep.property('profile.loginURL');
    });
  });
  describe('profile-manage-failure', function () { //eslint-disable-line
    this.timeout(10000);
    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-00000000-NOT';

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

    it('should raise an error', () => {
      expect(error).to.not.be.null;
    });

    it('should return empty', () => {
      expect(response).to.not.have.deep.property('profile.loginURL');
    });
  });
};
