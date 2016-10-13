'use strict';

const mgr = require('../../../lib/subscription-manager');
const expect = require('chai').expect;

describe('store products', () => {
  let error;
  let response;

  before(() => {
    return mgr.getProducts()
      .then(
        res => (response = res),
        err => (error = err)
      );
  });

  it('should find products', () => {
    expect(response).to.be.not.empty;
  });

  it('should not have errored', () => {
    if (error) {
      console.log(`Caught an error: ${error.message}`);
      console.log(error.stack);
    }

    expect(error).to.be.empty;
  });
});

const ID = 'MaaS-Test-' + Math.random() * 1000;
// skip to avoid polluting subscriptions
describe.skip('create user', () => {
  let error;
  let response;

  before(() => {
    return mgr.createUser(ID, 'fi-whim-payg', {
      phone: '+358555666',
    })
      .then(
        res => (response = res),
        err => (error = err)
      );
  });

  it('should find products', () => {
    expect(response).to.be.not.empty;
  });

  it('should not have errored', () => {
    expect(error).to.be.empty;
  });
});

describe.skip('create subscription', () => {
  let error;
  let response;

  before(done => {
    return mgr.purchaseSubscription('MaaS-Test-296.01563489995897', 'fi-whim-payg')
      .then(
        res => (response = res),
        err => (error = err)
      );
  });

  it('should find products', () => {
    expect(response).to.be.not.empty;
  });

  it('should not have errored', () => {
    if (error) {
      console.log(`Caught an error: ${error.message}`);
      console.log(error.stack);
    }

    expect(error).to.be.empty;
  });
});

describe('user by ID', () => {

  let error;
  let response;

  before(() => {
    /*'IG5rynMPlZaTwQ1nSg'*/
    return mgr.getUser('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb')
    .then(
      res => (response = res),
      err => (error = err)
    );
  });

  it('should find the user', () => {
    expect(response).to.be.not.empty;
  });

  it('should not have errored', () => {
    if (error) {
      console.log(`Caught an error: ${error.message}`);
      console.log(error.stack);
    }

    expect(error).to.be.empty;
  });
});

describe('user by ID not found', () => {
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

  let error;
  let response;

  before(() => {
    return mgr.updateUser('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb', {
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
        res => (response = res),
        err => (error = err)
      );
  });

  it('should have changed the user', () => {
    expect(response).to.be.not.empty;
  });

  it('should not have errored', () => {
    if (error) {
      console.log(`Caught an error: ${error.message}`);
      console.log(error.stack);
    }

    expect(error).to.be.empty;
  });
});

describe('Update User card', function () {
  this.timeout(5000);

  let response;
  let error;

  before(() => {
    return mgr.updateUserCreditCard('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb', {
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
      res => (response = res),
      err => (error = err)
    );
  });

  it('Should  work since Stripe is configured in test', () => {
    expect(response).to.not.be.empty;
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
  let error;
  let response;
  this.timeout(5000);

  before(() => {
    return mgr.getUserSubscription('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb')
    .then(
      res => (response = res),
      err => (error = err)
    );
  });

  it('should have a subscription', () => {
    expect(response).to.be.not.empty;
  });

  it('should not have errored', () => {
    if (error) {
      console.log(`Caught an error: ${error.message}`);
      console.log(error.stack);
    }

    expect(error).to.be.empty;
  });
});

describe('Create Portal Session', function () {
  let error;
  let response;
  this.timeout(5000);

  before(done => {
    mgr.getLoginURL('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb').then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      console.log('Error', data);
      done();
    });
  });

  it('should have a URL', () => {
    expect(response).to.be.not.empty;
    expect(response).to.have.property('loginURL');
    expect(response).to.have.deep.property('expires');
    //console.log(response);
  });

  it('should not have an error', () => {
    expect(error).to.be.empty;
  });
});

describe('Create Portal Session', function () {
  let error;
  let response;
  this.timeout(5000);

  before(done => {
    mgr.getLoginURL('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb').then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      console.log('Error', data);
      done();
    });
  });

  it('should have a URL', () => {
    expect(response).to.be.not.empty;
    expect(response).to.have.property('loginURL');
    expect(response).to.have.deep.property('expires');
    //console.log(response);
  });

  it('should not have an error', () => {
    expect(error).to.be.empty;
  });
});

describe('Post a charge on the user', function () {
  let error;
  let response;
  this.timeout(5000);

  before(() => {
    return mgr.makePurchase('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb', 'fi-whim-points-purchase-payg', 100)
    .then(
      res => (response = res),
      err => (error = err)
    );
  });

  it('should have changed the user', () => {
    expect(response).to.be.not.empty;
  });

  it('should have no error', () => {
    if (error) {
      console.log(`Caught an error: ${error.message}`);
      console.log(error.stack);
    }

    expect(error).to.be.empty;
  });
});

describe('Change User Plan', function () {
  let error;
  let response;
  this.timeout(5000);

  before(() => {
    return mgr.updatePlan('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb', 'fi-whim-payg' )
    .then(
      res => (response = res),
      err => (error = err)
    );
  });

  it('should have changed the user plan', () => {
    expect(response).to.be.not.empty;
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
    return mgr.updatePlan('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb', 'fi-whim-medium', 'FI-WHIM-NONEXISTING' )
    .then(
      res => (response = res),
      err => (error = err)
    );
  });

  it('should NOT have changed the user plan', () => {
    expect(response).to.be.empty;
  });

  it('should have an error', () => {
    /*if (error) {
      console.log(`Caught an error: ${error.message}`);
      console.log(error.stack);
    }*/

    expect(error).to.not.be.empty;
  });
});
