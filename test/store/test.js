const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const lambda = require('../../store/store-packages/handler.js');

describe('Store packages', function () {
  var error;
  var response;

  before(done => {
    const event = {
      id: process.env.TAXI_ORDER_ID,
    };

    wrap(lambda).run(event, (err, data) => {
      error = err;
      response = data;
      done();
    });
  });

  it('gets valid packages', function () {
    expect(response).to.be.not.null;
  });
});
