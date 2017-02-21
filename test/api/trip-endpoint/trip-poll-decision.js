'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;

module.exports = function (lambda, swfStub) {

  describe('poll new decisions tasks with too low maxBlockingTimeInSec', () => {
    let error;
    let response;

    const invalidEvent = {
      maxBlockingTimeInSec: 1,
    };

    before(done => {
      swfStub.pollForDecisionTaskAsync = params => {
        return Promise.resolve();
      };
      wrap(lambda).run(invalidEvent, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should give 400 error', () => {
      expect(response).to.be.undefined;
      expect(error).to.have.property('code').and.be.a('number').and.to.equal(400);
      expect(error).to.have.property('message').and.contain('maxBlockingTimeInSec');
    });

    after(done => {
      swfStub.pollForDecisionTaskAsync = undefined;
      done();
    });

  });

  describe('poll new decisions tasks with too high maxBlockingTimeInSec', () => {
    let error;
    let response;

    const invalidEvent = {
      maxBlockingTimeInSec: 1000,
    };

    before(done => {
      swfStub.pollForDecisionTaskAsync = params => {
        return Promise.resolve();
      };
      wrap(lambda).run(invalidEvent, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should give 400 error', () => {
      expect(response).to.be.undefined;
      expect(error).to.have.property('code').and.be.a('number').and.to.equal(400);
      expect(error).to.have.property('message').and.contain('maxBlockingTimeInSec');
    });

    after(done => {
      swfStub.pollForDecisionTaskAsync = undefined;
      done();
    });

  });

  describe('poll new decisions for while', () => {
    let error;
    let response;

    const validEvent = {
      maxBlockingTimeInSec: 10,
    };

    before(done => {
      swfStub.pollForDecisionTaskAsync = params => {
        return Promise
          .delay(2000)
          .then(() => {
            return Promise.resolve({
              startedEventId: 0,
              previousStartedEventId: 0,
            });
          });
      };
      wrap(lambda).run(validEvent, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('without errors', () => {
      expect(response).to.be.null;
      expect(error).to.be.null;
    });

    after(done => {
      swfStub.pollForDecisionTaskAsync = undefined;
      done();
    });

  });

};
