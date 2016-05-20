
process.env.CHARGEBEE_API_KEY = 'tbd:';
process.env.CHARGEBEE_SITE = 'whim-test';

var mgr = require('../../../lib/subscription-manager');
var expect = require('chai').expect;

describe('store products', function () {
  var error;
  var response;

  before(function (done) {
    mgr.getProducts().then((data) => {
      response = data;
      done();
    }).catch(data => {
      console.log('getproducts was not successful', data);
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
  var error;
  var response;

  before(function (done) {
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

describe('user by ID', function () {
  var error;
  var response;

  before(function (done) {
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


describe('update User', function () {
  var error;
  var response;

  before(function (done) {
    mgr.updateUser('IG5rynMPlZaTwQ1nSg', {
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

describe('update User card', function () {
  var error;
  var response;

  before(function (done) {
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

  it('should have added the card', function () {
    expect(response).to.be.empty;
  });
});

describe('List the user plan', function () {
  var error;
  var response;

  before(function (done) {
    mgr.getUserSubscription('IG5rynMPlZaTwQ1nSg').then(data => {
      response = data;
      console.log(data);
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
