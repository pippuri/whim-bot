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

  describeOrSkip('request for a route from an unsupported region', () => {

    const event = {
      from: '-66.6630267,140.0016841', // Dumont d'Urville Station, Antarctica
      to: '60.1684126,24.9316739', // SC5 Office, Helsinki
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
      expect(error).to.be.null;
    });

    it('should trigger an empty response', () => {
      expect(response.plan.itineraries.length).to.equal(0);
    });

  });
};
