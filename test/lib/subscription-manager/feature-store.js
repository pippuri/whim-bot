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
    expect(response).to.not.be.empty;
    expect(response.length).to.equal(2);
    expect(response[0]).to.not.be.empty;
    expect(response[0].list).to.not.be.empty;
    expect(response[0].list.length).to.be.least(0);
    expect(response[1]).to.not.be.empty;
    expect(response[1].list).to.not.be.empty;
    expect(response[1].list.length).to.be.least(0);
  });

  it('should not have errored', () => {
    if (error) {
      console.log(`Caught an error: ${error.message}`);
      console.log(error.stack);
    }

    expect(error).to.be.empty;
  });
});
