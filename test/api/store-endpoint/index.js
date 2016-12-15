'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../../store/store-packages/handler');

describe('Store packages', () => {
  // let error;
  let response;

  before(done => {
    const event = {
      id: process.env.TAXI_ORDER_ID,
    };

    wrap(lambda).run(event, (err, data) => {
      // error = err;
      response = data;
      done();
    });
  });

  it('gets valid packages', () => {
    expect(response).to.be.not.null;
    expect(response.plans).to.be.defined;
    expect(response.plans).to.not.be.empty;
    expect(response.addons).to.be.defined;
    expect(response.addons).to.not.be.empty;
  });
});
