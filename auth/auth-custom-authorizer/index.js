'use strict';

const jwt = require('jsonwebtoken');

// arn:aws:execute-api:<regionId>:<accountId>:<apiId>/<stage>/<method>/<resourcePath>
// First capture group denotes the real resource, e.g. PUT/tracking/user-location
const arnRE = /^(arn:aws:execute-api:[\w\-]+:\d{12}:[\w]+\/[\w]+\/)([\w\-\s\/]+)+$/;
const identityIdRE = /^[aepus]{2}-[\w]{4}-\d:[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/;
const authRE = /^Bearer ([^\s]+)$/;

/**
 * Parses the authorization token of format "Bearer: {jwt token}"
 *
 * @param {string} authorization The authorization token to parse
 * @return {string} the parsed token, e.g. whatever follows after the "Bearer: "
 */
function parseToken(authorization) {
  const match = `${authorization}`.match(authRE);

  // Invalid or missing token
  if (!match) {
    const message = `Malformed authorization token '${authorization}'.`;
    throw new TypeError(message);
  }

  return match[1];
}

/**
 * Parses the arn resource of format
 * arn:aws:execute-api:<regionId>:<accountId>:<apiId>/<stage>/<method>/<resourcePath>
 *
 * @param {string} arn The resource to parse
 * @return {string} a parsed version that permits access to all stage resources
 */
function parseResource(arn) {
  if (!arnRE.test(arn)) {
    throw new TypeError(`Invalid arn resource: '${arn}'`);
  }

  // Return a version of arn that permits all the resources with all methods
  const replacement = arn.replace(arnRE, '$1*');
  return replacement;
}

/**
 * Creates a policy that will be returned from the custom authorized
 *
 * @param {string} identityId - User identity to authorize
 * @param {string} effect - 'Allow' if allow access, or 'Deny' to deny it
 * @param {string} arn - Resource to permit
 */
function createPolicy(identityId, effect, arn) {
  return {
    principalId: identityId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: arn,
        },
      ],
    },
  };
}

/**
 * Authorization handling - either respond with a valid policy, or
 * 'Unauthorized' to generate a 401 response from custom authorizer.
 */
module.exports.respond = function (event, callback) {
  try {
    const authorization = event.authorizationToken;
    console.info(`Parsing authorization token '${JSON.stringify(authorization)}'`);
    const token = parseToken(authorization);

    console.info(`Verifying JWT token ${JSON.stringify(token)}`);
    const contents = jwt.verify(token, process.env.JWT_SECRET);

    const identityId = contents.id;
    if (!identityIdRE.test(identityId)) {
      throw new TypeError(`Invalid identityId: '${identityId}'`);
    }

    const resource = parseResource(event.methodArn);

    console.info(`Authorizing user '${identityId}' for resource '${resource}'`);
    callback(null, createPolicy(identityId, 'Allow', resource));
  } catch (error) {
    console.warn(`Caught an error: ${error.message}, ${JSON.stringify(error, null, 2)}`);
    console.warn(`This event caused error: ${JSON.stringify(event, null, 2)}`);
    console.warn(error.stack);

    // In any failure case generate 'Unauthorized, so that we get a 401 response'
    callback('Unauthorized');
  }
};
