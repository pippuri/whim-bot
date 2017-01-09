'use strict';

const bus = require('../../../lib/service-bus');
const expect = require('chai').expect;
const Promise = require('bluebird');
const SubscriptionManager = require('../../../lib/business-objects/SubscriptionManager');
const subscriptionsEstimateSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-estimate/response.json');
const subscriptionsOptionsSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-options/response.json');
const subscriptionsUpdateSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-update/response.json');
const validator = require('../../../lib/validator');

describe('subscriptions-full-flow', function () { // eslint-disable-line

  let error;
  let logged = false;

  let listSubscriptionOptionsResponse;
  let estimateSubscriptionUpdateResponse;
  let updateSubscriptionResponse;

  const customerId = 'eu-west-1:00000000-dead-dead-eaea-000000000000';
  const userId = customerId;

  before(() => {
    console.info('Creating test customer & subscription');
    const testCustomer = { identityId: customerId, phone: '+358123456' };
    const testSubscription = { plan: { id: 'fi-whim-payg' } };

    return SubscriptionManager.retrieveCustomer(customerId)
      .catch(error => {
        return SubscriptionManager.createCustomer(testCustomer)
        .then(() => SubscriptionManager.createSubscription(
          testSubscription,
          customerId,
          userId
        ));
      })
      .catch(err => (error = err));
  });

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
    console.info('Deleting test customer & subscription');
    return SubscriptionManager.deleteCustomer(customerId)
      .then(
        () => console.info('Rollback succeeded'),
        err => console.error(`Rollback failed: ${err.toString()}`)
      );
  });

  it('Lists the available subscription options', () => {
    const event = {
      identityId: customerId,
      payload: { lat: 64, lon: 24 },
    };

    return bus.call('MaaS-subscriptions-options', event)
      .then(
        res => Promise.resolve(listSubscriptionOptionsResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(listSubscriptionOptionsResponse.options.length).to.be.at.least(1);
        expect(validator.validateSync(
          subscriptionsOptionsSchema,
          listSubscriptionOptionsResponse
        )).to.exist;
      });
  });

  it('Contains Medium package that costs 249 with HSL Helsinki', () => {
    const pkg = listSubscriptionOptionsResponse.options.find(opt => {
      return opt.name === 'Medium';
    });
    expect(pkg).to.exist;

    const hslHelsinki = pkg.addons.find(addon => addon.id === 'fi-hsl-helsinki');
    expect(hslHelsinki).to.exist;

    // Note: This works because of hack: 249 + null = 249;
    const totals = pkg.plan.price.amount + hslHelsinki.unitPrice.amount;
    expect(totals).to.equal(249);
  });

  it('Estimates the fi-medium price with HSL add-on', () => {
    const event = {
      customerId: customerId,
      userId: userId,
      payload: {
        plan: { id: 'fi-whim-medium' },
        addons: [{ id: 'fi-hsl-helsinki', quantity: 1 }],
      },
    };

    return bus.call('MaaS-subscriptions-estimate', event)
      .then(
        res => Promise.resolve(estimateSubscriptionUpdateResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionsEstimateSchema,
          estimateSubscriptionUpdateResponse
        )).to.exist;
      });
  });

  it('Updates the subscription', () => {
    const event = {
      customerId: customerId,
      userId: userId,
      payload: estimateSubscriptionUpdateResponse.estimate,
    };

    bus.call('MaaS-subscriptions-update', event)
      .then(
        res => Promise.resolve(updateSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionsUpdateSchema,
          updateSubscriptionResponse
        )).to.exist;
      });
  });
});
