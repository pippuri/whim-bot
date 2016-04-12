var Promise = require('bluebird');
var AWS = require('aws-sdk');
var jwt = require('jsonwebtoken');

// This is the main custom authorizer that can be attached to any API
// that's limited to logged in users.

function customAuthorize(event) {
  console.log('Custom authorizer checking', event);
  var m = ('' + event.authorizationToken).match(/^Bearer +([^ ]+)$/);
  if (!m) {
    // Invalid authorization
    return Promise.reject('Unauthorized');
  }
  var token = m[1];
  var user;

  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Invalid authorization
    console.log('Error verifying JWT token:', err);
    return Promise.reject('Unauthorized');
  }

  console.log('Token contents:', user);

  return Promise.resolve()
  .then(function () {
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
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
