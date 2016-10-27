'use strict';

const Database = require('../../../lib/models/Database');
const ProfileDAO = require('../../../lib/models/Profile');
const Profile = require('../../../lib/business-objects/Profile');
const bus = require('../../../lib/service-bus/index');
const expect = require('chai').expect;
const testEvents = require('./test-events.json');
const LAMBDA = 'MaaS-profile-webhook';

const CHARGEBEE_ID = 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM';
const DUMMY_ID = 'dummy';


module.exports = function (identityId) {
  function extractCustomerIdentityId(customerWebhookContent) {
    return customerWebhookContent.content.customer.id;
  }

  //------------------------------------------------------------------------
  // Customer Changed {{{
  describe('profile-webhook-customer-changed', () => {
    const webhookContent = testEvents.positive.customer_changed;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: {
        webhook_status: 'not_configured',
        event_type: 'customer_changed',
        content: webhookContent,
      },
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      // Fetch the profile from the database
      Database.init()
        .then(_ => {
          return ProfileDAO.query().findById(testIdentityId)
        })
        .then(profile => {
          pre = profile;
          // Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // Re-fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          post = profile;
          done();
        })
        .catch(err => {
          error = err;
          done();
        })
        .finally(() => {
          Database.cleanup();
        });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error during test: [${error.type}]: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.not.be.null;
      expect(response.response).to.be.defined;
      expect(response.response).to.equal('OK');
    });

    it('should have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.not.equal(post.firstName);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Unknown event {{{
  describe('profile-webhook-unknown-event', () => {
    const event = {
      id: CHARGEBEE_ID,
      payload: {
        webhook_status: 'not_configured',
        event_type: 'not_a_known_event',
        content: 'Where is everybody?',
      },
    };

    let response = null;
    let error = null;

    before(done => {
      bus.call(LAMBDA, event)
        .then(data => {
          response = data;
          done();
        })
        .catch(err => {
          error = err;
          done();
        });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error during test: [${error.type}]: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.not.be.null;
      expect(response.response).to.be.defined;
      expect(response.response).to.equal('OK');
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Unauthorized event {{{
  describe('profile-webhook-unauthorized-event', () => {
    const event = {
      id: 'NOT_VALID',
      payload: {
        content: 'Where is everybody?',
      },
    };

    let response = null;
    let error = null;

    before(done => {
      bus.call(LAMBDA, event)
        .then(data => {
          response = data;
          done();
        })
        .catch(err => {
          error = err;
          done();
        });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error during test: [${error.type}]: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.not.be.null;
      expect(response.response).to.be.defined;
      expect(response.response).to.equal('OK');
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Dummy event {{{
  describe('profile-webhook-dummy-event', () => {
    const event = {
      id: DUMMY_ID,
      payload: {
        content: 'HELLO',
      },
    };

    let response = null;
    let error = null;

    before(done => {
      bus.call(LAMBDA, event)
        .then(data => {
          response = data;
          done();
        })
        .catch(err => {
          error = err;
          done();
        });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error during test: [${error.type}]: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.not.be.null;
      expect(response.response).to.be.defined;
      expect(response.response).to.equal('OK');
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Negative test events {{{
  for (const event_type in testEvents.negative) {
    if (!testEvents.negative.hasOwnProperty(event_type)) {
      console.log(`Negative: ${event_type}. Nope.`);
      continue;
    }

    const testName = `profile-webhook-chargebee-test-events-negative [${event_type}]`;

    if (event_type.startsWith('_')) {
      describe.skip(testName, () => {});
      continue;
    }

    describe(testName, () => {
      const event = {
        id: CHARGEBEE_ID,
        payload: {
          webhook_status: 'not_configured',
          event_type: event_type,
          content: testEvents.negative[event_type],
        },
      };

      let response = null;
      let error = null;

      before(done => {
        bus.call(LAMBDA, event)
          .then(data => {
            response = data;
            done();
          })
          .catch(err => {
            error = err;
            done();
          });
      });

      it('should not raise an error', () => {
        if (error) {
          console.log(`Caught an error during test: [${error.type}]: ${error.message}`);
          console.log(error.stack);
        }

        expect(error).to.be.null;
      });

      it('should not return empty', () => {
        expect(response).to.not.be.null;
        expect(response.response).to.be.defined;
        expect(response.response).to.equal('OK');
      });
    });
  }
  //}}}//

  //------------------------------------------------------------------------
  // Badly formed test events {{{
  for (const event_type in testEvents.badly_formed) {
    if (!testEvents.badly_formed.hasOwnProperty(event_type)) {
      continue;
    }

    const testName = `profile-webhook-chargebee-test-events-badly-formed [${event_type}]`;

    if (event_type.startsWith('_')) {
      describe.skip(testName, () => {});
      continue;
    }

    describe(testName, () => {
      const event = {
        id: 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM',
        BAD_payload: {
          webhook_status: 'not_configured',
          event_type: event_type,
          content: testEvents.badly_formed[event_type],
        },
      };

      let response = null;
      let error = null;

      before(done => {
        bus.call(LAMBDA, event)
          .then(data => {
            response = data;
            done();
          })
        .catch(err => {
          error = err;
          done();
        });
      });

      it('should not raise an error', () => {
        if (error) {
          console.log(`Caught an error during test: [${error.type}]: ${error.message}`);
          console.log(error.stack);
        }

        expect(error).to.be.null;
      });

      it('should not return empty', () => {
        expect(response).to.not.be.null;
        expect(response.response).to.be.defined;
        expect(response.response).to.equal('OK');
      });
    });
  }
  //}}}//

  //------------------------------------------------------------------------
  // Positive test events {{{
  for (const event_type in testEvents.positive) {
    if (!testEvents.positive.hasOwnProperty(event_type)) {
      continue;
    }

    const testName = `profile-webhook-chargebee-test-events-positive [${event_type}]`;

    if (event_type.startsWith('_')) {
      describe.skip(testName, () => {});
      continue;
    }

    describe(testName, () => {
      const event = {
        id: CHARGEBEE_ID,
        payload: {
          webhook_status: 'not_configured',
          event_type: event_type,
          content: testEvents.negative[event_type],
        },
      };

      let response = null;
      let error = null;

      before(done => {
        bus.call(LAMBDA, event)
          .then(data => {
            response = data;
            done();
          })
          .catch(err => {
            error = err;
            done();
          });
      });

      it('should not raise an error', () => {
        if (error) {
          console.log(`Caught an error during test: [${error.type}]: ${error.message}`);
          console.log(error.stack);
        }

        expect(error).to.be.null;
      });

      it('should not return empty', () => {
        expect(response).to.not.be.null;
        expect(response.response).to.be.defined;
        expect(response.response).to.equal('OK');
      });
    });
  }
  //}}}
};
