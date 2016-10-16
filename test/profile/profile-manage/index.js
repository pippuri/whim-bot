'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-manage/handler.js');

module.exports = function (identityId) {

  describe('profile-manage', function () { //eslint-disable-line
    this.timeout(10000);

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

    const event = {
      identityId: identityId.replace('cafe', 'dead'),
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
