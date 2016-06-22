'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment');

module.exports = function (lambda) {

  describe('request without "from"', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000', // test user
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
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
      expect(error).not.to.be.null;
    });

    it('should provide the expected error message', () => {
      expect(error.message).to.equal('Missing "from" argument.');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

  });
};
