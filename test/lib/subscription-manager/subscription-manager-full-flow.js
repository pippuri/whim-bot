'use strict';

const mgr = require('../../../lib/subscription-manager');
const expect = require('chai').expect;

describe('subscription-full-flow', () => {

  const chargebeeId = 'MaaS-Test-' + Math.round(Math.random() * 1000000, 10);
  const newSubscription = 'fi-whim-payg';
  const updatedSubscription = 'fi-whim-light';

  let error;
  let createUserResponse;
  let retrieveUserResponse;
  let updateUserResponse;
  let updateUserCardResponse;
  let listPlanResponse;
  let purchaseResponse;
  let changePlanResponse;
  let getLoginURLResponse;

  // Before each test we check if a previous test has errored.
  // If so, skip the test.
  beforeEach(function () {
    if (error) {
      this.skip();
    }
  });

  describe('create user', () => {
    before(() => {
      return mgr.createUser(chargebeeId, newSubscription, { phone: '+358555666' })
        .then(
          res => (createUserResponse = res),
          err => (error = err)
        );
    });

    it('should find products', () => {
      expect(createUserResponse).to.not.be.empty;
    });

    it('should not have errored', () => {
      expect(error).to.be.empty;
    });
  });

  describe('retrieve user by id', () => {
    before(() => {
      return mgr.getUser(chargebeeId)
      .then(
        res => (retrieveUserResponse = res),
        err => (error = err)
      );
    });

    it('should find the user', () => {
      expect(retrieveUserResponse).to.be.not.empty;
    });

    it('should not have errored', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.empty;
    });
  });

  describe('retrieve invalid user id', () => {
    let error;
    let response;

    before(() => {
      return mgr.getUser('eagegeagehehaehae')
      .then(
        res => (response = res),
        err => (error = err)
      );
    });

    it('should not find the user', () => {
      expect(response).to.be.empty;
    });

    it('should have errored', () => {
      expect(error).to.exist;
    });
  });

  describe('Update user', function () {
    this.timeout(10000);

    before(() => {
      return mgr.updateUser(chargebeeId, {
        firstName: 'Tester_' + Math.floor((Math.random() * 1000)),
        lastName: 'User',
        email: 'me@maas.fi',
        phone: '+358555666',
        street: 'Töölonlahdenkatu 2',
        country: 'FI',
        zip: '00110',
        city: 'Helsinki',
      })
        .then(
          res => (updateUserResponse = res),
          err => (error = err)
        );
    });

    it('should have changed the user', () => {
      expect(updateUserResponse).to.be.not.empty;
    });

    it('should not have errored', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.empty;
    });
  });

  describe('Update user card', function () {
    this.timeout(5000);

    before(() => {
      return mgr.updateUserCreditCard(chargebeeId, {
        firstName: 'Test',
        lastName: 'User',
        email: 'me@maas.fi',
        zip: '02270',
        city: 'Espoo',
        country: 'FI',
        card: {
          number: '4012888888881881',
          cvv: '999',
          expiryMonth: '01',
          expiryYear: '2017',
        },
      })
      .then(
        res => (updateUserCardResponse = res),
        err => (error = err)
      );
    });

    it('Should  work since Stripe is configured in test', () => {
      expect(updateUserCardResponse).to.not.be.empty;
    });

    it('should not have errored', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.empty;
    });
  });

  describe('List the user plan', function () {
    this.timeout(5000);

    before(() => {
      return mgr.getUserSubscription(chargebeeId)
      .then(
        res => (listPlanResponse = res),
        err => (error = err)
      );
    });

    it('should have a subscription', () => {
      expect(listPlanResponse).to.be.not.empty;
    });

    it('should not have errored', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.empty;
    });
  });

  describe('Post a charge on the user', function () {
    this.timeout(5000);

    before(() => {
      return mgr.makePurchase(chargebeeId, 'fi-whim-points-purchase-payg', 100)
      .then(
        res => (purchaseResponse = res),
        err => (error = err)
      );
    });

    it('should have changed the user', () => {
      expect(purchaseResponse).to.be.not.empty;
    });

    it('should have no error', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.empty;
    });
  });

  describe('Change user plan', function () {
    this.timeout(5000);

    before(() => {
      return mgr.updatePlan(chargebeeId, updatedSubscription)
      .then(
        res => (changePlanResponse = res),
        err => (error = err)
      );
    });

    it('should have changed the user plan', () => {
      expect(changePlanResponse).to.be.not.empty;
    });

    it('should have no error', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.empty;
    });

  });

  describe('Change User Plan with nonexisting promo code', function () {
    let error;
    let response;
    this.timeout(5000);

    before(() => {
      return mgr.updatePlan(chargebeeId, 'fi-whim-medium', 'FI-WHIM-NONEXISTING' )
      .then(
        res => (response = res),
        err => (error = err)
      );
    });

    it('should NOT have changed the user plan', () => {
      expect(response).to.be.empty;
    });

    it('should have an error', () => {
      expect(error).to.not.be.empty;
    });
  });

  describe('Create Portal Session', function () {
    this.timeout(5000);

    before(() => {
      return mgr.getLoginURL(chargebeeId).then(
        res => (getLoginURLResponse = res),
        err => (error = err)
      );
    });

    it('should have a URL', () => {
      expect(getLoginURLResponse).to.be.not.empty;
      expect(getLoginURLResponse).to.have.property('loginURL');
      expect(getLoginURLResponse).to.have.deep.property('expires');
    });

    it('should not have an error', () => {
      expect(error).to.be.empty;
    });
  });
});
