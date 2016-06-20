'use strict';

const mgr = require('../../../lib/subscription-manager');
const expect = require('chai').expect;

describe('store products', function () {
  let error;
  let response;

  before(done => {
    mgr.getProducts().then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      done();
    });
  });

  it('should find products', function () {
    expect(response).to.be.not.empty;
  });

  it('should not have errored', function () {
    expect(error).to.be.empty;
  });
});

describe('user by ID', function () {
  let error;
  let response;

  before(done => {
    mgr.getUser('IG5rynMPlZaTwQ1nSg').then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      done();
    });
  });

  it('should find the user', function () {
    expect(response).to.be.not.empty;
  });
});

describe('user by ID not found', function () {
  let error;
  let response;

  before(done => {
    mgr.getUser('eagegeagehehaehae').then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      done();
    });
  });

  it('should not find the user', function () {
    expect(response).to.be.empty;
  });
});

describe('Update user', function () {
  let error;
  let response;

  before(done => {
    mgr.updateUser('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb', {
      first_name: 'Test',
      last_name: 'User',
      email: 'me@maas.fi',
      phone: '+358555666',
      'billing_address[country]': 'FI',
      'billing_address[zip]': '00110',
    }).then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      done();
    });
  });

  it('should have changed the user', function () {
    expect(response).to.be.not.empty;
  });

  it('should have no error', function () {
    expect(error).to.be.empty;
  });
});

describe('Update User card', function () {
  let error;
  let response;

  before(done => {
    mgr.updateUserCreditCard('ergaegeaeageagrseg', {
      first_name: 'Test',
      last_name: 'User',
      email: 'me@maas.fi',
      phone: '+358555666',
      billing_country: 'FI',
      billing_zip: '00110',
      tmp_token: '46y6htbg35b',
    }).then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      done();
    });
  });

  it('Should not work since Stripe isnt configured', function () {
    expect(response).to.be.empty;
  });
});

describe('List the user plan', function () {
  let error;
  let response;

  before(done => {
    mgr.getUserSubscription('IG5rynMPlZaTwQ1nSg').then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      done();
    });
  });

  it('should have a subscription', function () {
    expect(response).to.be.not.empty;
  });

  it('should not have an error', function () {
    expect(error).to.be.empty;
  });
});
