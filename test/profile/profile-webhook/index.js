'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../profile/profile-webhook/handler.js');

module.exports = function () {

  describe('profile-webhook', () => {
    const event = {
      id: 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM',
      payload: {
        event_type: 'customer_created',
        webhook_status: 'not_configured',
        content: {
          customer: {
            id: 'eu-west-1:6d6ba277-783e-40e1-a05f-bf6794e76d0a',
            first_name: 'Benjamin',
            last_name: 'Ross',
          },
        },
      },
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
      expect(response).to.not.be.null;
    });
  });
};
