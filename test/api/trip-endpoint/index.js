'use strict';

// By defult, run tests so that AWS SWF is a mock. The SWF methods the trip-system calls,
// are actually local stubs so no calls to AWS are actually invoked. By setting MOCK_SWF false, the
// real SWF service is used, using DEV stage.
const MOCK_SWF = true;

const tripPollDecisionTest = require('./trip-poll-decision.js');
const tripInvokeDeciderTest = require('./trip-invoke-decider.js');

let tripPollDecisionLambda;
let tripInvokeDeciderLambda;
const swfStub = {};

if (MOCK_SWF === true) {
  const proxyquire = require('proxyquire');
  const sinon = require('sinon');
  tripPollDecisionLambda = proxyquire('../../../trip/trip-poll-decision/handler.js', {
    'aws-sdk': {
      SWF: sinon.stub().returns(swfStub),
      '@global': true,
    },
  });
  tripInvokeDeciderLambda = proxyquire('../../../trip/trip-invoke-decider/handler.js', {
    'aws-sdk': {
      SWF: sinon.stub().returns(swfStub),
      '@global': true,
    },
  });
} else {
  tripPollDecisionLambda = require('../../../trip/trip-poll-decision/handler.js');
  tripInvokeDeciderLambda = require('../../../trip/trip-invoke-decider/handler.js');
}

describe('trip endpoint', function () {
  this.timeout(20000);

  tripPollDecisionTest(tripPollDecisionLambda, swfStub);
  tripInvokeDeciderTest(tripInvokeDeciderLambda, swfStub);
});
