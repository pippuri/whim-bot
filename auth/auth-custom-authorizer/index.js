'use strict';

const Promise = require('bluebird');
const jwt = require('jsonwebtoken');

// This is the main custom authorizer that can be attached to any API
// that's limited to logged in users.

function customAuthorize(event) {
  console.info('Custom authorizer checking', event);
  const m = ('' + event.authorizationToken).match(/^Bearer +([^ ]+)$/);
  if (!m) {
    // Invalid authorization
    return Promise.reject('Unauthorized');
  }

  const token = m[1];
  let user;

  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Invalid authorization
    console.info('Error verifying JWT token:', err);
    return Promise.reject('Unauthorized');
  }

  console.info('Token contents:', user);

  return Promise.resolve()
  .then(() => {
    return {
      principalId: user.id,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn.replace(/\/.*$/, '/*'), // allow all API endpoints
          },
        ],
      },
    };
  });
}

module.exports.respond = function (event, callback) {
  customAuthorize(event)
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
