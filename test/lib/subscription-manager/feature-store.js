'use strict';

const mgr = require('../../../lib/subscription-manager');
const expect = require('chai').expect;

describe('store', () => {
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
