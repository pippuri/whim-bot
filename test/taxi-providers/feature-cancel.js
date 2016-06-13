'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;

module.exports = () => {
  const lambda = require('../../provider-taxi/provider-taxi-cancel/handler.js');

  describe('cancel order request', function () {
    var error;
    var response;

    before(done => {
      const event = {
        id: process.env.TAXI_ORDER_ID,
      };

      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should have been cancelled', function () {
      expect(response.cancelled).to.be.true;
    });
  });
};
