'use strict';

const contactSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/contact.json');
const expect = require('chai').expect;
const pricingSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/pricing.json');
const SubscriptionManager = require('../../../../lib/business-objects/SubscriptionManager');
const subscriptionSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscription.json');
const validator = require('../../../../lib/validator');

const newCustomer = require('./maas-contact-new.json');
const updatedCustomer = require('./maas-contact-full.json');
const subscription = require('./maas-subscription-new.json');
const addonSubscription = require('./maas-subscription-addon.json');

const fullSubscriptionSchema = subscriptionSchema.definitions.fullSubscription;
const fullContactSchema = contactSchema.definitions.fullContact;


describe('SubscriptionManager-full-flow', function () { // eslint-disable-line

  let error;
  let logged = false;

  let listSubscriptionOptionsResponse;
  let createCustomerResponse;
  let retrieveCustomerResponse;
  let updateCustomerResponse;
  let createSubscriptionResponse;
  let retrieveSubscriptionResponse;
  let estimateSubscriptionUpdateResponse;
  let retrieveSubscriptionsResponse;
  let updateSubscriptionResponse;
  let deleteCustomerResponse;

  const customerId = newCustomer.identityId;
  const userId = customerId;

  // Before each test we check if a previous test has errored. If so, skip
  // the test.
  beforeEach(function () {
    if (error) {
      this.skip();
    }
  });

  afterEach(() => {
    if (error && !logged) {
      console.error('Tests caught an error', error.toString());
      console.error(error.stack);

      if (error.response) {
        console.error(error.response.toString());
      }
      logged = true;
    }
  });

  after(() => {
    if (error) {
      console.log(`Trying to rollback the changes by deleting '${customerId}'`);
      /*return SubscriptionManager.deleteCustomer(customerId)
        .then(
          () => console.log('Rollback succeeded'),
          err => console.error(`Rollback failed: ${err.toString()}`)
        )
        .catch('');*/
    }

    return Promise.resolve();
  });

  it('Lists the available subscription options', () => {
    return SubscriptionManager.findSubscriptionOptions(updatedCustomer)
      .then(
        res => Promise.resolve(listSubscriptionOptionsResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Creates a new customer with no payment method', () => {
    // Fetch the customer - create if it does not exist
    return SubscriptionManager.retrieveCustomer(newCustomer.identityId)
      .catch(error => {
        console.warn('Customer `${customer.identityId}` already exists.');
        return SubscriptionManager.createCustomer(newCustomer);
      })
      .then(
        res => Promise.resolve(createCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Retrieves the customer', () => {
    return SubscriptionManager.retrieveCustomer(customerId)
      .then(
        res => Promise.resolve(retrieveCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Updates the customer', () => {
    return SubscriptionManager.updateCustomer(updatedCustomer)
      .then(
        res => Promise.resolve(updateCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Creates a new subscription', () => {
    return SubscriptionManager.createSubscription(subscription, customerId, userId)
      .then(
        res => Promise.resolve(createSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Retrieves the subscriptions by customer', () => {
    return SubscriptionManager.retrieveSubscriptionsByCustomerId(customerId)
      .then(
        res => Promise.resolve(retrieveSubscriptionsResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Retrieves the subscriptions by customer', () => {
    return SubscriptionManager.retrieveSubscriptionsByCustomerId(customerId)
      .then(
        res => Promise.resolve(retrieveSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Estimates the subscription upgrade price', () => {
    return SubscriptionManager.estimateSubscriptionUpdate(addonSubscription, userId, false, false)
      .then(
        res => Promise.resolve(estimateSubscriptionUpdateResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Updates the subscription', () => {
    return SubscriptionManager.updateSubscription(addonSubscription, customerId, userId, false, false)
      .then(
        res => Promise.resolve(updateSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });

  it('Deletes the customer', () => {
    return SubscriptionManager.deleteCustomer(newCustomer.identityId)
      .then(
        res => Promise.resolve(deleteCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        // TODO Assertions
      });
  });
});
