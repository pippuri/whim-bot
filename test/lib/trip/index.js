'use strict';

// By defult, run tests so that AWS SWF is a mock. The SWF methods the trip-system calls,
// are actually local stubs so no calls to AWS are actually invoked. By setting MOCK_SWF false, the
// real SWF service is used, using DEV stage.
const MOCK_SWF = true;

const expect = require('chai').expect;

let Trip;

const swfStub = {};

if (MOCK_SWF === true) {
  const proxyquire = require('proxyquire');
  const sinon = require('sinon');
  Trip = proxyquire('../../../lib/trip', {
    'aws-sdk': {
      SWF: sinon.stub().returns(swfStub),
      '@global': true,
    },
  });
} else {
  Trip = require('../../../lib/trip');
}

describe('utility Trip', function () {
  this.timeout(20000);
  let response;
  let error;

  describe('create', () => {

    before(done => {

      // define stub in case SWF is mocked
      swfStub.startWorkflowExecutionAsync = params => {
        expect(params).to.have.property('domain').and.be.a('string');
        expect(params).to.have.property('taskList').and.be.a('object');
        expect(params).to.have.property('workflowType').and.be.a('object');
        expect(params).to.have.property('lambdaRole').and.be.a('string');
        expect(params).to.have.property('taskList').and.be.a('object');
        expect(params).to.have.property('workflowId').and.be.a('string').and.to.equal('itinerary.288bf020-3c62-11e6-b3ee-8d653248757f');
        return Promise.resolve({
          runId: 'dummy',
          workFlowId: params.workflowId,
        });
      };

      Trip.create({
        identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
        referenceId: '288bf020-3c62-11e6-b3ee-8d653248757f',
        referenceType: 'itinerary',
        startTime: 1475314020000,
        endTime: 1475316632000,
      })
        .then(trip => {
          response = trip;
          done();
        })
        .catch(err => {
          error = err;
          done();
        });
    });

    it('should get trip object', () => {
      expect(error).to.be.undefined;
      expect(response).to.have.property('workFlowId').and.be.a('string').and.to.equal('itinerary.288bf020-3c62-11e6-b3ee-8d653248757f');
      expect(response).to.have.property('runId').and.be.a('string');
    });

    after(done => {
      swfStub.startWorkflowExecutionAsync = undefined;
      done();
    });

  });
});
