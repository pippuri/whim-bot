'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const event = require('../../../trip/trip-invoke-decider/event.json');

module.exports = function (lambda, swfStub) {

  describe('give decision task for decider', () => {
    let error;
    let response;

    before(done => {
      swfStub.respondDecisionTaskCompleted = params => {
        expect(params).to.have.property('taskToken').and.be.a('string');
        expect(params).to.have.property('decisions').and.be.a('array');
        return {
          promise: () => Promise.resolve(),
        };
      };
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should get workFlowId', () => {
      expect(error).to.be.null;
      expect(response).to.have.property('workFlowId').and.be.a('string').and.to.equal('Itinerary.288bf020-3c62-11e6-b3ee-8d653248757f');
    });

    after(done => {
      swfStub.respondDecisionTaskCompleted = undefined;
      done();
    });

  });

  describe('give bad decision task data for decicer', () => {
    let error;
    let response;

    const invalidEvent = {
      taskToken: 'dummy',
      startedEventId: 3,
      workflowExecution: {
        workflowId: 'Itinerary.fa4a73e0-5f29-11e6-8396-d7cb77ca864a',
        workflowType: {
          name: 'maas-trip',
          version: 'test-v3',
        },
        events: [],
      },
    };

    before(done => {
      swfStub.respondDecisionTaskCompleted = params => {
        expect(true).to.equal(false);
        return {
          promise: () => Promise.resolve(),
        };
      };
      wrap(lambda).run(invalidEvent, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should get 400 error', () => {
      expect(error).to.have.property('code').and.be.a('number').and.to.equal(400);
      expect(response).to.be.undefined;
    });

    after(done => {
      swfStub.respondDecisionTaskCompleted = undefined;
      done();
    });

  });
};
