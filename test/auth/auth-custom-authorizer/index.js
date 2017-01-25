'use strict';

const expect = require('chai').expect;
const lambda = require('../../../auth/auth-custom-authorizer/handler.js');
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
const token = jwt.sign({ id: testIdentityId }, secret);
const auth = `Bearer ${token}`;
const validEvent = {
  type: 'TOKEN',
  authorizationToken: auth,
  methodArn: 'arn:aws:execute-api:eu-west-1:756207178743:ddupr31jie/dev/PUT/tracking/user-location',
};
const validResponse = {
  principalId: testIdentityId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: 'Allow',
        Resource: 'arn:aws:execute-api:eu-west-1:756207178743:ddupr31jie/dev/*',
      },
    ],
  },
};
const complexARNEvent = {
  type: 'TOKEN',
  authorizationToken: auth,
  methodArn: 'arn:aws:execute-api:eu-west-1:756207178743:ddupr31jie/dev/PUT/subscriptions/eu-west-1:8f6cad33-1340-48ac-9dc9-5221bf107b95',
};


// Lambda runner that replaces service-bus. We need to have our own wrapper,
// so that we can reject with a non-error
function runLambda(lambda, event) {
  return new Promise((resolve, reject) => {
    const context = {
      done: (err, data) => {
        if (err !== null) {
          reject(new Error(err));
        }

        resolve(data);
      },
    };

    lambda.handler(event, context);
  });
}

describe('auth-custom-authorizer', () => {
  it('Returns a valid policy on valid token', () => {
    return runLambda(lambda, validEvent)
      .then(response => {
        expect(response).to.deep.equal(validResponse);
      });
  });

  it('Returns \'Unauthorized\' on wrong auth method', () => {
    const invalidTokenEvent = Object.assign({}, validEvent, {
      authorizationToken: 'Basic Zm9vOmJhcg==',
    });

    return runLambda(lambda, invalidTokenEvent)
      .then(
        response => (expect(response).to.not.exist),
        error => (expect(error.message).to.equal('Unauthorized'))
      );
  });

  it('Returns \'Unauthorized\' on invalid identityId in jwt token', () => {
    const token = jwt.sign({ id: 'gibberish' }, secret);
    const invalidIdentityEvent = Object.assign({}, validEvent, {
      authorizationToken: `Bearer ${token}`,
    });

    return runLambda(lambda, invalidIdentityEvent)
      .then(
        response => (expect(response).to.not.exist),
        error => (expect(error.message).to.equal('Unauthorized'))
      );
  });

  it('Returns \'Unauthorized\' on missing identityId in jwt token', () => {
    const token = jwt.sign({ id: undefined }, secret);
    const invalidIdentityEvent = Object.assign({}, validEvent, {
      authorizationToken: `Bearer ${token}`,
    });

    return runLambda(lambda, invalidIdentityEvent)
      .then(
        response => (expect(response).to.not.exist),
        error => (expect(error.message).to.equal('Unauthorized'))
      );
  });

  it('Returns \'Unauthorized\' on missing arn', () => {
    const invalidIdentityEvent = Object.assign({}, validEvent, {
      methodArn: null,
    });

    return runLambda(lambda, invalidIdentityEvent)
      .then(
        response => (expect(response).to.not.exist),
        error => (expect(error.message).to.equal('Unauthorized'))
      );
  });

  it('Returns a valid policy on a complex ARN', () => {
    return runLambda(lambda, complexARNEvent)
      .then(response => {
        expect(response).to.deep.equal(validResponse);
      });
  });

  it('Returns \'Unauthorized\' on empty event', () => {
    return runLambda(lambda, undefined)
      .then(
        response => (expect(response).to.not.exist),
        error => (expect(error.message).to.equal('Unauthorized'))
      );
  });
});
