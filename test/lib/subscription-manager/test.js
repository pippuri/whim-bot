//process.env.CHARGEBEE_API_KEY = null;
//process.env.CHARGEBEE_API_URL = null;

var mgr = require('../../../lib/subscription-manager');
var expect = require('chai').expect;

describe('store products', function () {
  var error;
  var response;

  before(function (done) {
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
    //console.log(JSON.stringify(response));
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

describe('create User', function () {
  var error;
  var response;

  before(function (done) {
    mgr.createUser('eu-west-1:01e0e77e-ea55-45fa-a1d2-cd9bd860137e', {
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

  it('should have added the user', function () {
    expect(response).to.be.empty;
    console.log(JSON.stringify(response));
  });
});

describe('update User card', function () {
  var error;
  var response;

  before(function (done) {
    mgr.updateUserCreditCard('IG5rynMPlZaTwQ1nSg', {
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
    console.log(JSON.stringify(response));
  });
});
