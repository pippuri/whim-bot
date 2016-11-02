'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment-timezone');

module.exports = (lambda, options) => {

  if (typeof options === typeof undefined) {
    options = {};
  }

  const describeOrSkip = (options.skip === true) ? (
    describe.skip
  ) : (
    describe
  );

  describeOrSkip('request for a route to an unsupported region', () => {

    const event = {
      from: '60.1684126,24.9316739', // SC5 Office, Helsinki
      to: '-66.6630267,140.0016841', // Dumont d'Urville Station, Antarctica
      leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
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

    it('should succeed without errors', () => {
      expect(error).to.not.be.null;
      expect(error.message).to.equal('500: Destination lies outside covered area.');
    });

    it('should not return any response', () => {
      expect(response).to.be.undefined;
    });

  });
};
