'use strict';

const mgr = require('../../../lib/subscription-manager');
const expect = require('chai').expect;

describe('store products', () => {
  let error;
  let response;

  before(done => {
    mgr.getProducts().then(data => {
      response = data;
      //console.log('products:' + JSON.stringify(data, null, 2));
      done();
    }).catch(data => {
      console.log('Error', data);
      error = data;
      done();
    });
  });

  it('should find products', () => {
    expect(response).to.be.not.empty;
  });

  it('should not have errored', () => {
    expect(error).to.be.empty;
  });
});

describe('user by ID', () => {
  // let error;
  let response;

  before(done => {
    mgr.getUser('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb' /*'IG5rynMPlZaTwQ1nSg'*/).then(data => {
      response = data;
      done();
    }).catch(data => {
      // error = data;
      done();
    });
  });

  it('should find the user', () => {
    expect(response).to.be.not.empty;
  });
});

describe('user by ID not found', () => {
  // let error;
  let response;

  before(done => {
    mgr.getUser('eagegeagehehaehae').then(data => {
      response = data;
      done();
    }).catch(data => {
      // error = data;
      done();
    });
  });

  it('should not find the user', () => {
    expect(response).to.be.empty;
  });
});

describe('Update user', () => {
  let error;
  let response;

  before(done => {
    mgr.updateUser('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb', {
      firstName: 'Tester' + Math.random() * 100,
      lastName: 'User',
      email: 'me@maas.fi',
      phone: '+358555666',
      address: 'Töölonlahdenkatu 2',
      country: 'FI',
      zip: '00110',
      city: 'Helsinki',
    }).then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      done();
    });
  });

  it('should have changed the user', () => {
    expect(response).to.be.not.empty;
  });

  it('should have no error', () => {
    expect(error).to.be.empty;
  });
});

describe('Update User card', () => {
  let response;

  before(done => {
    mgr.updateUserCreditCard('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb', {
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
    }).then(data => {
      response = data;
      done();
    }).catch(data => {
      console.log('Error', data);
      done();
    });
  });

  it('Should  work since Stripe is configured in test', () => {
    expect(response).to.not.be.empty;
  });
});

describe('List the user plan', () => {
  let error;
  let response;

  before(done => {
    mgr.getUserSubscription('eu-west-1:6b999e73-1d43-42b5-a90c-36b62e732ddb').then(data => {
      response = data;
      done();
    }).catch(data => {
      error = data;
      console.log('Error', data);
      done();
    });
  });

  it('should have a subscription', () => {
    expect(response).to.be.not.empty;
  });

  it('should not have an error', () => {
    expect(error).to.be.empty;
  });
});
