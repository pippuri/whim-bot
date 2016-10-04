'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-payment-get/handler.js');

module.exports = function () {

  describe('profile-card-get', () => {
    const identityId = 'eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb';

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

    it('should not be empty', () => {
      expect(response).to.not.deep.equal({});
    });
  });
};
