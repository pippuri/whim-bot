'use strict';

const AWS = require('aws-sdk');
const Database = require('../../lib/models/Database');
const errors = require('../../lib/errors/index');
const jwt = require('jsonwebtoken');
const lib = require('../lib/index');
const MaaSError = require('../../lib/errors/MaaSError');
const Profile = require('../../lib/business-objects/Profile');
const promiseUtils = require('../../lib/utils/promise');
const Transaction = require('../../lib/business-objects/Transaction');

const ci = new AWS.CognitoIdentity({ region: process.env.AWS_REGION });
const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
const iotCallback = new AWS.Iot({ region: process.env.AWS_REGION });
const getOpenIdTokenForDeveloperIdentityAsync = promiseUtils.promisify(ci.getOpenIdTokenForDeveloperIdentity, ci);
const cognito = {
  listRecordsAsync: promiseUtils.promisify(cognitoSync.listRecords, cognitoSync),
  updateRecordsAsync: promiseUtils.promisify(cognitoSync.updateRecords, cognitoSync),
};
const iot = {
  createThingAsync: promiseUtils.promisify(iotCallback.createThing, iotCallback),
  updateThingAsync: promiseUtils.promisify(iotCallback.updateThing, iotCallback),
  attachThingPrincipalAsync: promiseUtils.promisify(iotCallback.attachThingPrincipal, iotCallback),
  attachPrincipalPolicyAsync: promiseUtils.promisify(iotCallback.attachPrincipalPolicy, iotCallback),
};

/**
 * Create or retrieve Amazon Cognito identity.
 */
function getCognitoDeveloperIdentity(plainPhone) {

  // Use sha1 hash of subscriberId because it may contain spaces, which are not allowed in Cognito
  const logins = {};
  logins[process.env.COGNITO_DEVELOPER_PROVIDER] = 'tel:' + plainPhone;
  const options = {
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    Logins: logins,
  };
  console.info('Getting cognito developer identity with', JSON.stringify(options, null, 2));
  return getOpenIdTokenForDeveloperIdentityAsync(options)
  .then(response => {
    return {
      identityId: response.IdentityId,
      cognitoToken: response.Token,
    };
  });
}

/**
 * Create or update Amazon Cognito profile dataset.
 */
function updateCognitoProfile(identityId, profile) {
  let syncSessionToken;
  const patches = [];
  return cognito.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_PROFILE_DATASET,
  })
  .then(response => {
    syncSessionToken = response.SyncSessionToken;
    const oldRecords = {};
    response.Records.map(record => {
      oldRecords[record.Key] = record;
    });

    Object.keys(profile).map(key => {
      const oldRecord = oldRecords[key];
      let newValue;
      if (typeof profile[key] === 'object') {
        newValue = JSON.stringify(profile[key]);
      } else {
        newValue = '' + profile[key];
      }

      // Check if changed
      if (!oldRecord || newValue !== oldRecord.Value) {
        patches.push({
          Op: 'replace',
          Key: key,
          Value: newValue,
          SyncCount: oldRecord ? oldRecord.SyncCount : 0,
        });
      }
    });

    if (patches.length > 0) {
      return cognito.updateRecordsAsync({
        IdentityPoolId: process.env.COGNITO_POOL_ID,
        IdentityId: identityId,
        DatasetName: process.env.COGNITO_PROFILE_DATASET,
        SyncSessionToken: syncSessionToken,
        RecordPatches: patches,
      });
    }

    return Promise.resolve();
  });
}

/**
 * Create (if it doesn't exist yet) an IoT Thing for the user
 */
function createUserThing(identityId, plainPhone, isSimulationUser) {
  const thingName = identityId.replace(/:/, '-');
  console.info('Creating user thing', identityId, thingName);
  return iot.createThingAsync({
    thingName: thingName,
    attributePayload: {
      attributes: {
        // Up to three attributes can be attached here
        phone: plainPhone,
        type: isSimulationUser ? 'simulation' : 'user',
      },
    },
  })
  .then(null, err => {
    // Ignore already exists errors
    if (err.code === 'ResourceAlreadyExistsException') {
      return iot.updateThingAsync({
        thingName: thingName,
        attributePayload: {
          attributes: {
            // Up to three attributes can be attached here
            phone: plainPhone,
            type: isSimulationUser ? 'simulation' : 'user',
          },
        },
      });
    }

    console.warn('Error:', err.code, err);
    return Promise.reject(err);
  })
  .then(response => {
    // Attach the cognito identity to the thing
    return iot.attachThingPrincipalAsync({
      principal: identityId,
      thingName: thingName,
    });
  })
  .then(response => {
    console.info('AttachThingPrincipal response:', response);

    // Attach the cognito policy to the default policy
    return iot.attachPrincipalPolicyAsync({
      policyName: 'DefaultCognitoPolicy',
      principal: identityId,
    });
  })
  .then(response => {
    console.info('AttachPrincipalPolicy response:', response);
  });
}

/**
 * Login using a verification code sent by SMS.
 */
function smsLogin(phone, code) {
  let identityId;
  let cognitoToken;

  // Sanitize phone number, remove NaN
  const plainPhone = phone.replace(/[^\d]/g, '');
  const sanitizedPhone = phone.replace(/[^\d\+]/g, '');

  if (!plainPhone || plainPhone.length < 4) {
    return Promise.reject(new errors.MaaSError('Invalid phone number', 400));
  }

  // Support simulated users in dev environment using phone prefix +292
  // (which is an unused international code)
  const isSimulationUser = process.env.SERVERLESS_STAGE === 'dev' && plainPhone.match(/^\+292/);

  // Bale out if we can't verify the provided code
  console.info('Verifying SMS code ', code, ' from ', sanitizedPhone);
  if (!lib.verify_topt_login_code(isSimulationUser, sanitizedPhone, code)) {
    return Promise.reject(new errors.MaaSError('Unauthorized', 401));
  }

  // Everything OK, proceed
  return getCognitoDeveloperIdentity(plainPhone)
  .then(response => {
    identityId = response.identityId;
    cognitoToken = response.cognitoToken;
    return updateCognitoProfile(identityId, {
      phone: phone,
      verificationCode: code,
    });
  })
  .then(() => createUserThing(identityId, plainPhone, isSimulationUser))
  .then(() => {
    // First try to fetch an existing identity
    return Profile.retrieve(identityId)
      // No profile found, create one
      .catch(error => {
        // Profile not exist error code is 404, if not 404, throw forward the error
        if (error.code !== 404) {
          return Promise.reject(error);
        }

        const transaction = new Transaction(identityId);
        return transaction.start()
          .then(() => Profile.create(identityId, phone, transaction))
          .then(
            profile => transaction.commit('Profile created'),
            error => transaction.rollback().then(() => Promise.reject(error))
          );
      });
  })
  .then(() => {
    // Create a signed JSON web token
    const token = jwt.sign({ id: identityId }, process.env.JWT_SECRET);
    const zendeskToken = jwt.sign({ zendeskJwt: 1, userId: identityId }, process.env.JWT_SECRET);

    return {
      id_token: token,
      zendesk_token: zendeskToken,
      cognito_id: identityId,
      cognito_token: cognitoToken,
      cognito_pool: process.env.COGNITO_POOL_ID,
      cognito_provider: 'cognito-identity.amazonaws.com',
    };
  });
}

module.exports.respond = function (event, callback) {
  return Database.init()
    .then(() => smsLogin(`${event.phone}`, `${event.code}`))
    .then(
      response => Database.cleanup().then(() => response),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
