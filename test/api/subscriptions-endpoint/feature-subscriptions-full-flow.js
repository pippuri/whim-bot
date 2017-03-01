'use strict';

const bus = require('../../../lib/service-bus');
//const Database = require('../../../lib/models/Database');
const expect = require('chai').expect;
//const Profile = require('../../../lib/business-objects/Profile');
const SubscriptionManager = require('../../../lib/business-objects/SubscriptionManager');
const subscriptionsCustomerRetrieveSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-customer-retrieve/response.json');
const subscriptionsCustomerUpdateSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-customer-update/response.json');
const subscriptionsEstimateSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-estimate/response.json');
const subscriptionsOptionsSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-options/response.json');
const subscriptionsRetrieveSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-retrieve/response.json');
const subscriptionsUpdateSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-update/response.json');
const validator = require('../../../lib/validator');

describe('subscriptions-full-flow', function () { // eslint-disable-line

  let error;
  let logged = false;

  let retrieveCustomerResponse;
  let updateCustomerResponse;
  let listSubscriptionOptionsResponse;
  let estimateSubscriptionUpdateResponse;
  let updateSubscriptionResponse;
  let retrieveSubscriptionResponse;
  let updateSubscriptionResponse2;
  let retrieveSubscriptionResponse2;
  let retrieveFutureSubscriptionResponse;

  const customerId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000027';
  const userId = customerId;

  before(() => {
    console.info('Creating test customer & subscription');
    const testCustomer = {
      identityId: customerId,
      phone: '+358123456',
      city: 'Helsinki',
      zipCode: '00100',
      country: 'FI',
      paymentMethod: {
        type: 'card',
        number: '4012888888881881',
        expiryMonth: 10,
        expiryYear: 2022,
        cvv: '999',
      },
    };
    const testSubscription = { plan: { id: 'fi-whim-payg' } };

    //return Database.init()
    return Promise.resolve()
      .then(() => SubscriptionManager.retrieveCustomer(customerId))
      .catch(error => {
        console.info('SubscriptionManager customer not found, creating new.');
        return SubscriptionManager.createCustomer(testCustomer)
        .then(() => SubscriptionManager.createSubscription(
          testSubscription,
          customerId,
          userId
        ));
      })
      .catch(err => {
        error = err;
        console.warn('Error in creating the subscription, skipping the test.');
        console.warn(error.toString());
      });
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
      //.then(() => Database.cleanup());
  });

  it('Retrieves the existing customer', () => {
    const event = {
      userId: userId,
      customerId: customerId,
    };

    return bus.call('MaaS-subscriptions-customer-retrieve', event)
      .then(
        res => Promise.resolve(retrieveCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(retrieveCustomerResponse.customer.identityId).to.equal(customerId);
        expect(validator.validateSync(
          subscriptionsCustomerRetrieveSchema,
          retrieveCustomerResponse
        )).to.exist;
      });
  });

  it('Updates the customer', () => {
    const event = {
      userId: userId,
      customerId: customerId,
      payload: {
        identityId: customerId,
        phone: '+358123456',
        city: 'Helsinki',
        zipCode: '00100',
        country: 'FI',
        paymentMethod: {
          type: 'card',
          number: '4012888888881881',
          expiryMonth: 10,
          expiryYear: 2022,
          cvv: '999',
        },
      },
    };

    return bus.call('MaaS-subscriptions-customer-update', event)
      .then(
        res => Promise.resolve(updateCustomerResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(updateCustomerResponse.customer.identityId).to.equal(customerId);
        expect(updateCustomerResponse.customer.paymentMethod.valid).to.equal(true);
        expect(validator.validateSync(
          subscriptionsCustomerUpdateSchema,
          updateCustomerResponse
        )).to.exist;
      });
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

  xit('Contains Medium package costing 100 with HSL Helsinki on discount', () => {
    const pkg = listSubscriptionOptionsResponse.options.find(opt => {
      return opt.meta.name === 'Medium';
    });
    expect(pkg).to.exist;

    const hslHelsinki = pkg.addons.find(addon => addon.id === 'fi-hsl-helsinki');
    expect(hslHelsinki).to.exist;

    // Note: This works because of hack: 100 + null = 100;
    const totals = pkg.plan.price.amount + hslHelsinki.unitPrice.amount;
    expect(totals).to.equal(100);
  });

  it('Estimates the price of Medium plan with HSL Helsinki add-on', () => {
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

  it('Replaces the subscription to Medium plan with HSL Helsinki add-on', () => {
    const event = {
      customerId: customerId,
      userId: userId,
      payload: {
        plan: { id: 'fi-whim-medium' },
        addons: [{ id: 'fi-hsl-helsinki', quantity: 1 }],
      },
      headers: {
        Accept: 'application/json; version=1.0.0',
      },
      replace: true,
    };

    return bus.call('MaaS-subscriptions-update', event)
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

  it('Retrieves the subscription', () => {
    const event = {
      customerId: customerId,
      userId: userId,
    };

    return bus.call('MaaS-subscriptions-retrieve', event)
      .then(
        res => Promise.resolve(retrieveSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionsRetrieveSchema,
          retrieveSubscriptionResponse
        )).to.exist;
      });
  });

  it('Should match the updated plan and add-ons', () => {
    const retSubs = retrieveSubscriptionResponse.subscription;
    const upSubs = updateSubscriptionResponse.subscription;

    expect(retSubs.plan.id).to.equal(upSubs.plan.id);
    upSubs.addons.forEach(addon => {
      expect(retSubs.addons.find(a => a.id === addon.id)).to.exist;
    });
  });

  it('Tops-up balance with 500p', () => {
    //const points = 500;
    const event = {
      customerId: customerId,
      userId: userId,
      payload: {
        addons: [{ id: 'fi-whim-top-up', quantity: 500 }],
      },
      headers: {
        Accept: 'application/json; version=1.0.0',
      },
      replace: false,
    };

    // Note: This might magically fail if some of the web hooks trigger
    // the same time. Therefore they are disabled by default
    // let oldBalance;
    return Promise.resolve()
      /*.then(() => Profile.retrieve(userId, ['balance']))
      .then(profile => (oldBalance = profile.balance))*/
      .then(() => bus.call('MaaS-subscriptions-update', event))
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
      /*.then(() => Profile.retrieve(userId, ['balance']))
      .then(profile => {
        const newBalance = profile.balance;
        expect(newBalance - oldBalance).to.equal(points);
      });*/
  });

  it('Replaces the Medium subscription with a scheduled change to plain Light', () => {
    const event = {
      customerId: customerId,
      userId: userId,
      payload: {
        plan: { id: 'fi-whim-light' },
        addons: [],
      },
      headers: {
        Accept: 'application/json; version=1.0.0',
      },
      replace: true,
    };

    return bus.call('MaaS-subscriptions-update', event)
      .then(
        res => Promise.resolve(updateSubscriptionResponse2 = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionsUpdateSchema,
          updateSubscriptionResponse2
        )).to.exist;
      });
  });

  it('Response should match the current plan and add-ons', () => {
    const retSubs = retrieveSubscriptionResponse.subscription;
    const upSubs = updateSubscriptionResponse2.subscription;

    expect(retSubs.plan.id).to.equal(upSubs.plan.id);
    upSubs.addons.forEach(addon => {
      expect(retSubs.addons.find(a => a.id === addon.id)).to.exist;
    });
  });

  it('Retrieves the current subscription', () => {
    const event = {
      customerId: customerId,
      userId: userId,
    };

    return bus.call('MaaS-subscriptions-retrieve', event)
      .then(
        res => Promise.resolve(retrieveSubscriptionResponse2 = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionsRetrieveSchema,
          retrieveSubscriptionResponse2
        )).to.exist;
      });
  });

  it('Should match the current plan & add-ons with scheduled changes flag', () => {
    const retSubs = retrieveSubscriptionResponse.subscription;
    const retSubs2 = retrieveSubscriptionResponse2.subscription;

    expect(retSubs2.plan.id).to.equal(retSubs.plan.id);
    retSubs.addons.forEach(addon => {
      expect(retSubs2.addons.find(a => a.id === addon.id)).to.exist;
    });

    expect(retSubs2.terms.scheduledChanges).to.equal(true);
  });

  it('Retrieves the future subscription', () => {
    const event = {
      customerId: customerId,
      userId: userId,
      nextPeriod: true,
    };

    return bus.call('MaaS-subscriptions-retrieve', event)
      .then(
        res => Promise.resolve(retrieveFutureSubscriptionResponse = res),
        err => Promise.reject(error = err)
      )
      .then(() => {
        expect(validator.validateSync(
          subscriptionsRetrieveSchema,
          retrieveFutureSubscriptionResponse
        )).to.exist;
      });
  });

  it('Should match the future subscription plan', () => {
    const retFutureSubs = retrieveFutureSubscriptionResponse.subscription;

    expect(retFutureSubs.plan.id).to.equal('fi-whim-light');
    expect(retFutureSubs.addons.length).to.equal(0);
  });
});
