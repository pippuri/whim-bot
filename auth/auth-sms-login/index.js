'use strict';

const Promise = require('bluebird');
const crypto = require('crypto');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const MaaSError = require('../../lib/errors/MaaSError');
const Database = require('../../lib/models/Database');
const Profile = require('../../lib/business-objects/Profile');

let greenlist;
try {
  greenlist = require(process.env.AUTH_GREENLIST_JSON);
}
catch (err) { /* swallow */ }  // eslint-disable-line brace-style

const cognitoIdentity = new AWS.CognitoIdentity({ region: process.env.AWS_REGION });
const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
const iot = new AWS.Iot({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoIdentity);
Promise.promisifyAll(cognitoSync);
Promise.promisifyAll(iot);

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
  return cognitoIdentity.getOpenIdTokenForDeveloperIdentityAsync(options)
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
  return cognitoSync.listRecordsAsync({
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
      return cognitoSync.updateRecordsAsync({
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

    console.info('ERROR:', err.code, err);
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
    return iot.listPrincipalPoliciesAsync({
      principal: identityId,
    });
  })
  .then(response => {
    console.info('Attached policies:', response);
    return iot.listPrincipalThingsAsync({
      principal: identityId,
    });
  })
  .then(response => {
    console.info('Attached things:', response);
  });
}

/**
 * Login using a verification code sent by SMS.
 */
function smsLogin(phone, code) {
  let identityId;
  let cognitoToken;
  let correctCode;
  // Sanitize phone number, remove NaN
  const plainPhone = phone.replace(/[^\d]/g, '');
  if (!plainPhone || plainPhone.length < 4) {
    return Promise.reject(new MaaSError('Invalid phone number', 401));
  }

  // Support simulated users in dev environment using phone prefix +292 (which is an unused international code)
  const isSimulationUser = process.env.SERVERLESS_STAGE === 'dev' && plainPhone.match(/^292/);

  if (isSimulationUser) {
    // Simulation users accept login with code 292
    console.info('User is a simulation user');
    correctCode = '292';
  } else {
    // Real users must have a real code from Twilio
    const shasum = crypto.createHash('sha1');
    const salt = code.slice(0, 3);
    shasum.update(salt + process.env.SMS_CODE_SECRET + plainPhone);
    const hash = shasum.digest('hex');
    correctCode = salt + '' + (100 + parseInt(hash.slice(0, 3), 16));
  }

  if (typeof greenlist === typeof undefined) {
    console.log('Not checking against greenlist');
  } else {
    console.log('Checking against greenlist ', process.env.AUTH_GREENLIST_JSON, ' for', plainPhone, 'phone', phone);
    if (greenlist.indexOf(plainPhone) === -1) {
      return Promise.reject(new MaaSError('401 Unauthorized', 401));
    }
  }

  console.info('Verifying SMS code', code, 'for', phone, 'plainphone', plainPhone, 'correct', correctCode);
  if (correctCode !== code) {
    return Promise.reject(new MaaSError('401 Unauthorized', 401));
  }

  return getCognitoDeveloperIdentity(plainPhone)
  .then(response => {
    identityId = response.identityId;
    cognitoToken = response.cognitoToken;
    return updateCognitoProfile(identityId, {
      phone: phone,
      verificationCode: code,
    });
  })
  .then(() => {
    return createUserThing(identityId, plainPhone, isSimulationUser);
  })
  .then(() => {
    const profilePayload = {
      identityId: identityId,
      payload: {
        phone: phone,
      },
    };

    // First try to fetch an existing identity
    return Profile.retrieve(identityId)
      .catch(error => {
        // No profile found
        return Profile.create(identityId, phone);
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
  .then(response => {

    return Database.cleanup()
      .then(() => callback(null, response));
  })
  .catch(_error => {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    return Database.cleanup()
    .then(() => {
      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
  });
};
