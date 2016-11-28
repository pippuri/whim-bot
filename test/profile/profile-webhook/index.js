'use strict';

const Database = require('../../../lib/models/Database');
const ProfileDAO = require('../../../lib/models/Profile');
const errors = require('../../../lib/errors/index');
const bus = require('../../../lib/service-bus/index');
const expect = require('chai').expect;
const testEvents = require('./test-events.json');
const LAMBDA = 'MaaS-profile-webhook';

const CHARGEBEE_ID = 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM';
const DUMMY_ID = 'dummy';


module.exports = function (identityId) {
  function extractCustomerIdentityId(webhookContent) {
    return webhookContent.content.customer.id;
  }

  //------------------------------------------------------------------------
  // Customer Changed {{{
  describe('profile-webhook-customer-changed', () => {
    const webhookContent = testEvents.positive.customer_changed;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.not.equal(post.firstName);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Customer Created {{{
  describe('profile-webhook-customer-created', () => {
    const webhookContent = testEvents.positive.customer_created;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should NOT have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.equal(post.firstName);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Customer Deleted {{{
  describe('profile-webhook-customer-deleted', () => {
    const webhookContent = testEvents.positive.customer_deleted;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should have updated the balance', () => {
      expect(post.balance).to.be.defined;
      expect(post.balance).to.equal(0);
    });

    it('should have updated the subscription plan', () => {
      expect(pre.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.be.defined;
      expect(pre.subscription.planId).to.not.equal(post.subscription.planId);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Subscription Created {{{
  describe('profile-webhook-subscription-created', () => {
    const webhookContent = testEvents.positive.subscription_created;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should NOT have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.equal(post.firstName);
    });

    it('should NOT have updated the plan', () => {
      expect(pre.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.be.defined;
      expect(pre.subscription.planId).to.equal(post.subscription.planId);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Subscription Started {{{
  describe('profile-webhook-subscription-started', () => {
    const webhookContent = testEvents.positive.subscription_started;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should NOT have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.equal(post.firstName);
    });

    it('should NOT have updated the plan', () => {
      expect(pre.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.be.defined;
      expect(pre.subscription.planId).to.equal(post.subscription.planId);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Subscription Activated {{{
  describe('profile-webhook-subscription-activated', () => {
    const webhookContent = testEvents.positive.subscription_activated;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should NOT have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.equal(post.firstName);
    });

    it('should NOT have updated the plan', () => {
      expect(pre.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.be.defined;
      expect(pre.subscription.planId).to.equal(post.subscription.planId);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Subscription Changed {{{
  describe('profile-webhook-subscription-changed', () => {
    const webhookContent = testEvents.positive.subscription_changed;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should NOT have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.equal(post.firstName);
    });

    it('should have updated the subscription plan', () => {
      expect(pre.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.be.defined;
      expect(pre.subscription.planId).to.not.equal(post.subscription.planId);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Subscription Cancelled {{{
  describe('profile-webhook-subscription-cancelled', () => {
    const webhookContent = testEvents.positive.subscription_cancelled;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should NOT have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.equal(post.firstName);
    });

    it('should have updated the balance', () => {
      expect(post.balance).to.be.defined;
      expect(post.balance).to.equal(0);
    });

    it('should have updated the subscription plan', () => {
      expect(pre.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.be.defined;
      expect(pre.subscription.planId).to.not.equal(post.subscription.planId);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Subscription Deleted {{{
  describe('profile-webhook-subscription-deleted', () => {
    const webhookContent = testEvents.positive.subscription_deleted;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should NOT have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.equal(post.firstName);
    });

    it('should have updated the balance', () => {
      expect(post.balance).to.be.defined;
      expect(post.balance).to.equal(0);
    });

    it('should have updated the subscription plan', () => {
      expect(pre.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.be.defined;
      expect(pre.subscription.planId).to.not.equal(post.subscription.planId);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Subscription Renewed {{{
  describe('profile-webhook-subscription-renewed', () => {
    const webhookContent = testEvents.positive.subscription_renewed;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(done => {
      Database.init()
        .then(_ => {
          // 1. Fetch the profile from the database
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(profile => {
          pre = profile;
          // 2. Apply the webhook
          return bus.call(LAMBDA, event);
        })
        .then(data => {
          response = data;

          // 3. Re-fetch the profile from the database for comparison
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });

    it('should NOT have updated the first name', () => {
      expect(pre.firstName).to.be.defined;
      expect(post.firstName).to.be.defined;
      expect(pre.firstName).to.equal(post.firstName);
    });

    it('should have updated the balance', () => {
      expect(post.balance).to.be.defined;
      expect(post.balance).to.equal(5500);
    });

    it('should NOT have updated the subscription plan', () => {
      expect(pre.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.be.defined;
      expect(pre.subscription.planId).to.equal(post.subscription.planId);
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

    it('the response should contain an error', () => {
      expect(response).to.include.key(errors.errorMessageFieldName);
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

    it('the response should contain an error', () => {
      expect(response).to.include.key(errors.errorMessageFieldName);
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

    it('the response should NOT contain an error', () => {
      expect(response).to.not.include.key(errors.errorMessageFieldName);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Default test events {{{
  for (const event_type in testEvents.default) {
    if (!testEvents.default.hasOwnProperty(event_type)) {
      continue;
    }

    const testName = `profile-webhook-chargebee-test-events-default [${event_type}]`;

    describe(testName, () => {
      const event = {
        id: CHARGEBEE_ID,
        payload: testEvents.default[event_type],
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

      it('the response should NOT contain an error', () => {
        expect(response).to.not.include.key(errors.errorMessageFieldName);
      });
    });
  }
  //}}}//
};
