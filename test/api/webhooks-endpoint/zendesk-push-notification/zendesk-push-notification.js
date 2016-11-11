'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;

const zendeskPushNotiticationLambda = require('../../../../webhooks/zendesk-push-notification/handler');
const positiveEvents = require('./zendesk-push-notification-positive-events.json');
const negativeEvents = require('./zendesk-push-notification-negative-events.json');

function runLambda(lambda, event) {
  return new Promise((resolve, reject) => {
    wrap(lambda).run(event, (error, response) => {
      return (error) ? reject(error) : resolve(response);
    });
  });
}

module.exports = function (input, results) {
  describe('send push notifications', () => {

    it('valid ones to be succesful or fail with none sent', () => {

      const doPositives = positiveEvents.map(event => {
        return runLambda(zendeskPushNotiticationLambda, event).reflect();
      });

      return Promise.all(doPositives)
        .each(inspection => {
          if (!inspection.isFulfilled()) {
            expect(inspection.reason().message.match(/No successful push sends/)).not.to.be.null;
          }
        })
        .then(() => Promise.resolve());

    });

    it('should fail with validation with bad ones', () => {

      const doNegatives = negativeEvents.map(event => {
        return runLambda(zendeskPushNotiticationLambda, event).reflect();
      });

      return Promise.all(doNegatives)
        .each(inspection => {
          expect(inspection.reason().message.match(/Validation failed/)).not.to.be.null;
        })
        .then(() => Promise.resolve());

    });
  });
};
