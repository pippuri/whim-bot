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

const newSubscriptionSchema = subscriptionSchema.definitions.newSubscription;
const subscriptionResponseSchema = subscriptionSchema.definitions.subscriptionResponse;
const newContactSchema = contactSchema.definitions.newContact;
const updateContactSchema = contactSchema.definitions.contactUpdate;
const contactResponseSchema = contactSchema.definitions.contactResponse;

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
  let deleteSubscriptionResponse;
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
      console.log('Something failed, rolling back customer creation.');
      return SubscriptionManager.deleteCustomer(customerId)
        .then(
          () => console.log('Rollback succeeded'),
          err => console.error(`Rollback failed: ${err.toString()}`)
        );
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
        expect(listSubscriptionOptionsResponse.length).to.be.at.least(1);

        listSubscriptionOptionsResponse.map(option => {
          expect(validator.validateSync(newSubscriptionSchema, option)).to.exist;
        });
      });
  });

  it('Contains Medium package that costs 249 with HSL Helsinki', () => {
    const pkg = listSubscriptionOptionsResponse.find(opt => {
      return opt.name === 'Medium';
    });
    expect(pkg).to.exist;

    const hslHelsinki = pkg.addons.find(addon => addon.id === 'fi-hsl-helsinki');
    expect(hslHelsinki).to.exist;

    // Note: This works because of hack: 249 + null = 249;
    const totals = pkg.plan.price.amount + hslHelsinki.unitPrice.amount;
    expect(totals).to.equal(249);
  });

  it('Creates a new customer with no payment method', () => {
    // Fetch the customer - create if it does not exist
    return SubscriptionManager.retrieveCustomer(customerId)
      .catch(error => {
        console.warn(`Customer '${newCustomer.identityId}' already exists.`);
        return SubscriptionManager.createCustomer(newCustomer);
      })
      .then(
        res => Promise.resolve(createCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          contactResponseSchema,
          createCustomerResponse
        )).to.exist;
      });
  });

  it('Retrieves the customer', () => {
    return SubscriptionManager.retrieveCustomer(customerId)
      .then(
        res => Promise.resolve(retrieveCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          contactResponseSchema,
          retrieveCustomerResponse
        )).to.exist;
      });
  });

  it('Updates the customer', () => {
    return SubscriptionManager.updateCustomer(updatedCustomer)
      .then(
        res => Promise.resolve(updateCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          contactResponseSchema,
          updateCustomerResponse
        )).to.exist;
      });
  });

  it('Creates a new Medium subscription with Helsinki regional', () => {
    const pkg = listSubscriptionOptionsResponse.find(opt => {
      return opt.name === 'Medium';
    });
    expect(pkg).to.exist;
    const subs = {
      plan: pkg.plan,
      addons: [{ id: 'fi-hsl-helsinki', quantity: 1 }],
      coupons: pkg.coupons,
    };

    return SubscriptionManager.createSubscription(subs, customerId, userId)
      .then(
        res => Promise.resolve(createSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionResponseSchema,
          createSubscriptionResponse
        )).to.exist;
      });
  });

  it('Retrieves the subscriptions by customer', () => {
    return SubscriptionManager.retrieveSubscriptionsByCustomerId(customerId)
      .then(
        res => Promise.resolve(retrieveSubscriptionsResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(retrieveSubscriptionsResponse.length).to.equal(1);

        retrieveSubscriptionsResponse.forEach(subscription => {
          expect(validator.validateSync(
            subscriptionResponseSchema,
            subscription
          )).to.exist;
        });
      });
  });

  it('Retrieves the user subscription', () => {
    return SubscriptionManager.retrieveSubscriptionByUserId(userId)
      .then(
        res => Promise.resolve(retrieveSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionResponseSchema,
          retrieveSubscriptionResponse
        )).to.exist;
      });
  });

  it('Estimates the subscription upgrade price', () => {
    return SubscriptionManager.estimateSubscriptionUpdate(addonSubscription, customerId, userId, true, false)
      .then(
        res => Promise.resolve(estimateSubscriptionUpdateResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          pricingSchema,
          estimateSubscriptionUpdateResponse
        )).to.exist;
      });
  });

  it('Updates the subscription', () => {
    return SubscriptionManager.updateSubscription(addonSubscription, customerId, userId, true, false)
      .then(
        res => Promise.resolve(updateSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionResponseSchema,
          updateSubscriptionResponse
        )).to.exist;
      });
  });

  it('Deletes the user subscription', () => {
    return SubscriptionManager.deleteSubscription(userId)
      .then(
        res => Promise.resolve(deleteSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionResponseSchema,
          deleteSubscriptionResponse
        )).to.exist;
      });
  });

  it('Deletes the customer', () => {
    return SubscriptionManager.deleteCustomer(customerId)
      .then(
        res => Promise.resolve(deleteCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          contactResponseSchema,
          deleteCustomerResponse
        )).to.exist;
      });
  });
});
