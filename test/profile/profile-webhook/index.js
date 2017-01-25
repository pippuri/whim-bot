'use strict';

const bus = require('../../../lib/service-bus/index');
const Database = require('../../../lib/models/Database');
const errors = require('../../../lib/errors/index');
const expect = require('chai').expect;
const ProfileDAO = require('../../../lib/models/Profile');
const testEvents = require('./test-events.json');

const LAMBDA = 'MaaS-profile-webhook';
const CHARGEBEE_ID = 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM';
const DUMMY_ID = 'dummy';
const WHIM_DEFAULT_PLAN = 'fi-whim-payg';
const WHIM_MEDIUM_POINTS_BALANCE = 5500;

module.exports = function () {
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should have updated the plan according to Chargebee', () => {
      expect(post.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.equal(webhookContent.content.subscription.plan_id);
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should have updated the plan according to Chargebee', () => {
      expect(post.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.equal(webhookContent.content.subscription.plan_id);
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should have updated the plan according to Chargebee', () => {
      expect(post.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.equal(webhookContent.content.subscription.plan_id);
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should have resetted the balance', () => {
      expect(pre.balance).to.be.defined;
      expect(post.balance).to.be.defined;
      expect(pre.balance).to.not.equal(post.balance);
      expect(post.balance).to.equal(WHIM_MEDIUM_POINTS_BALANCE);
    });
  });

  describe('profile-webhook-subscription-changed-no-reset', () => {
    const webhookContent = testEvents.positive.subscription_changed_no_reset;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should NOT have updated the balance', () => {
      expect(pre.balance).to.be.defined;
      expect(post.balance).to.be.defined;
      expect(pre.balance).to.equal(post.balance);
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should have updated the plan to pay-as-you-go plan', () => {
      expect(post.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.equal(WHIM_DEFAULT_PLAN);
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

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should have updated the plan according to Chargebee', () => {
      expect(post.subscription.planId).to.be.defined;
      expect(post.subscription.planId).to.equal(webhookContent.content.subscription.plan_id);
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Card Added {{{
  describe('profile-webhook-card-added', () => {
    const webhookContent = testEvents.positive.card_added;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => {
            (error = err);
            console.log('KONK0', err);
          }
        )
        .finally(() => Database.cleanup());
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

    it('should NOT have updated the zipcode', () => {
      expect(pre.zipCode).to.be.defined;
      expect(post.zipCode).to.be.defined;
      expect(pre.zipCode).to.equal(post.zipCode);
    });

    it('paymentMethod.status should be updated to `valid`', () => {
      expect(pre.paymentMethod).to.be.defined;
      expect(post.paymentMethod).to.be.defined;
      expect(post.paymentMethod.status).to.be.defined;
      expect(post.paymentMethod.status).to.equal('valid');
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Card Changed {{{
  describe('profile-webhook-card-updated', () => {
    const webhookContent = testEvents.positive.card_updated;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should NOT have updated the zipcode', () => {
      expect(pre.zipCode).to.be.defined;
      expect(post.zipCode).to.be.defined;
      expect(pre.zipCode).to.equal(post.zipCode);
    });

    it('paymentMethod.status should be updated to `valid`', () => {
      expect(pre.paymentMethod).to.be.defined;
      expect(post.paymentMethod).to.be.defined;
      expect(post.paymentMethod.status).to.be.defined;
      expect(post.paymentMethod.status).to.equal('valid');
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Card Expiry Reminder {{{
  describe('profile-webhook-card-expiry-reminder', () => {
    const webhookContent = testEvents.positive.card_expiry_reminder;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should NOT have updated the zipcode', () => {
      expect(pre.zipCode).to.be.defined;
      expect(post.zipCode).to.be.defined;
      expect(pre.zipCode).to.equal(post.zipCode);
    });

    it('paymentMethod.status should be updated to `valid`', () => {
      expect(pre.paymentMethod).to.be.defined;
      expect(post.paymentMethod).to.be.defined;
      expect(post.paymentMethod.status).to.be.defined;
      expect(post.paymentMethod.status).to.equal('valid');
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Card Expired {{{
  describe('profile-webhook-card-expired', () => {
    const webhookContent = testEvents.positive.card_expired;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should NOT have updated the zipcode', () => {
      expect(pre.zipCode).to.be.defined;
      expect(post.zipCode).to.be.defined;
      expect(pre.zipCode).to.equal(post.zipCode);
    });

    it('paymentMethod.status should be updated to `invalid`', () => {
      expect(pre.paymentMethod).to.be.defined;
      expect(post.paymentMethod).to.be.defined;
      expect(post.paymentMethod.status).to.be.defined;
      expect(post.paymentMethod.status).to.equal('invalid');
    });
  });
  //}}}

  //------------------------------------------------------------------------
  // Card Deleted {{{
  describe('profile-webhook-card-deleted', () => {
    const webhookContent = testEvents.positive.card_deleted;
    const testIdentityId = extractCustomerIdentityId(webhookContent);

    const event = {
      id: CHARGEBEE_ID,
      payload: webhookContent,
    };

    let pre = null;
    let post = null;
    let response = null;
    let error = null;

    before(() => {
      return Database.init()
        // 1. Fetch the profile from the database
        .then(() => ProfileDAO.query().findById(testIdentityId))
        // 2. Apply the webhook
        .then(profile => {
          pre = profile;
          return bus.call(LAMBDA, event);
        })
        // 3. Re-fetch the profile from the database for comparison
        .then(data => {
          response = data;
          return ProfileDAO.query().findById(testIdentityId);
        })
        .then(
          profile => (post = profile),
          err => (error = err)
        )
        .finally(() => Database.cleanup());
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

    it('should NOT have updated the zipcode', () => {
      expect(pre.zipCode).to.be.defined;
      expect(post.zipCode).to.be.defined;
      expect(pre.zipCode).to.equal(post.zipCode);
    });

    it('paymentMethod.status should be updated to `invalid`', () => {
      expect(pre.paymentMethod).to.be.defined;
      expect(post.paymentMethod).to.be.defined;
      expect(post.paymentMethod.status).to.be.defined;
      expect(post.paymentMethod.status).to.equal('invalid');
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

    before(() => {
      return bus.call(LAMBDA, event)
        .then(
          data => (response = data),
          err => (error = err)
        );
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

    before(() => {
      return bus.call(LAMBDA, event)
        .then(
          data => (response = data),
          err => (error = err)
        );
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

    before(() => {
      return bus.call(LAMBDA, event)
        .then(
          data => (response = data),
          err => (error = err)
        );
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

      before(() => {
        return bus.call(LAMBDA, event)
          .then(
            data => (response = data),
            err => (error = err)
          );
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
