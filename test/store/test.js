var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var lambda = require('../../store/store-packages/handler.js');

describe('Store packages', function () {
  var error;
  var response;

  before(function (done) {
    var event = {
      id: process.env.TAXI_ORDER_ID,
    };

    wrap(lambda).run(event, function (err, data) {
      error = err;
      response = data;
      done();
    });
  });

  it('gets valid packages', function () {
    expect(response).to.be.not.null;
  });
});
