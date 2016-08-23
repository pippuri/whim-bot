'use strict';

// Dependency
const AWS = require('aws-sdk');
const Promise = require('bluebird');
const _ = require('lodash');
const crypto = require('crypto');
const uuid = require('node-uuid');
const sortObject = require('deep-sort-object');
const MaaSError = require('../errors/MaaSError');
const request = require('request-promise-lite');

// Library
const bus = require('../../lib/service-bus/index');

// Dependency object
const cognitoIdentity = new AWS.CognitoIdentity({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoIdentity);

/**
 * Check if document existance in Dynamo
 * @param  {String} tableName - Dynamo tableName
 * @param  {String} hashKey - Dynamo hash key
 * @param  {String} hashValue - Dynamo hash value
 * @param  {String} rangeKey - Dynamo range key
 * @param  {String} rangeValue - Dynamo range value
 * @return {Promise -> Boolean}
 * TODO this is only for Dynamo, implement Postgres as well
 */
function documentExist(tableName, hashKey, hashValue, rangeKey, rangeValue) {

  if (!hashKey) {
    return Promise.reject(new Error('Required Hash Key Missing'));
  } else if (hashValue === '' || typeof hashValue === typeof undefined) {
    return Promise.reject(new Error('Missing Hash Value'));
  }

  const params = {
    TableName: tableName,
    Key: {},
  };

  params.Key[hashKey] = hashValue;

  if (rangeKey !== null) {
    if (rangeValue !== null) {
      params.Key[rangeKey] = rangeValue;
    } else {
      return Promise.reject(new Error('Missing RANGE Value'));
    }
  }

  return bus.call('Dynamo-get', params)
    .then(response => {
      if (!_.isEmpty(response)) { // If not empty -> exist
        return Promise.resolve(true);
      }

      return Promise.resolve(false);
    });
}

/**
 * check phoneNumber validity from twilio API
 * @param  {String} phoneNumber - Internationally formatted phoneNumber
 * @return {Promise -> phoneNumber}
 */
function checkPhoneNumber(phoneNumber) {
  return request.get(`https://lookups.twilio.com/v1/PhoneNumbers/${phoneNumber}`, {
    auth: `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_ACCOUNT_TOKEN}`,
  })
  .then(response => {
    return Promise.resolve(response.phone_number);
  })
  .catch(error => {
    return Promise.reject(new MaaSError('Invalid phone number', 403));
  });
}

/**
 * [getCognitoDeveloperIdentity description]
 * @param  {String} phoneNumber
 * @return {Object} contains identityId and cognitoToken
 */
function getCognitoDeveloperIdentity(phoneNumber) {
  return checkPhoneNumber(phoneNumber)
    .then(response => {
      const logins = {};
      logins[process.env.COGNITO_DEVELOPER_PROVIDER] = 'tel:' + response.phoneNumber;
      const options = {
        IdentityPoolId: process.env.COGNITO_POOL_ID,
        Logins: logins,
      };

      console.info('Getting cognito developer identity with', JSON.stringify(options, null, 2));

      return cognitoIdentity.getOpenIdTokenForDeveloperIdentityAsync(options);
    })
    .then(response => {
      return {
        identityId: response.IdentityId,
        cognitoToken: response.Token,
      };
    });
}

/**
 * Parse single(1) Chargebee plan to maas readable format
 * @param  {Object} input
 * @return {Object}
 */
function parseSingleChargebeePlan(input) {

  const planContext = input.plan;
  const output = {
    id: planContext.id,
    name: planContext.name,
    invoiceName: planContext.invoice_name,
    price: planContext.price / 100,
    currency: planContext.meta_data.currency,
    formattedPrice: `planContext.meta_data.currency ${planContext.price / 100}`,
    description: planContext.meta_data.description,
    pointGrant: planContext.meta_data.pointGrant,
    level: planContext.meta_data.level,
    tiers: planContext.meta_data.tiers,
    period: planContext.period,
    periodUnit: planContext.period_unit,
    chargeModel: planContext.charge_model,
    feature: planContext.meta_data.features,
    provider: planContext.meta_data.provider,
  };
  return output;
}

/**
 * Parse single(1) Chargebee addon to maas readable format
 * @param  {Object} input
 * @return {Object}
 */
function parseSingleChargebeeAddon(input) {

  const addonContext = input.addon;

  const output = {
    id: addonContext.id,
    name: addonContext.name,
    invoiceName: addonContext.invoice_name,
    price: addonContext.price / 100,
    period: addonContext.period,
    periodUnit: addonContext.period_unit,
    chargeModel: addonContext.charge_model,
  };

  return output;
}

/**
 * Schedule a function after a period of time
 * @param  {Object} Params - event input for the scheduled function, contains functionId, functionName, parameters for the function and invokeTime
 * @return {Promise -> Object} - Dynamo changes
 */
function scheduleFunction(Params) {
  if (_.isEmpty(Params)) {
    return Promise.reject(new Error('Input missing'));
  } else if (Params.functionName === '' || !Params.hasOwnProperty('functionName')) {
    return Promise.reject(new Error('Missing functionName'));
  }

  Params.functionId = Params.functionName + '_' + Date.now();
  return documentExist(process.env.MAAS_SCHEDULER, 'functionId', Params.functionId, null, null)
    .then(response => {
      if (response === true) { // True if existed
        return Promise.reject(new Error('function ID already exists'));
      }

      {
        const record = {
          functionId: Params.functionId,
          functionName: Params.functionName,
          parameters: Params.parameters,
          invokeTime: Params.invokeTime,
          flag: 'SCHEDULED',
          functionResponse: ' ',
        };

        const params = {
          Item: record,
          TableName: process.env.MAAS_SCHEDULER,
        };

        return bus.call('Dynamo-put', params);
      }
    });
}

/**
 * Create a v1 UUID
 * @return {UUID} UUID v1
 * TODO Use users' public IP address or such for generating the first 6 bytes (now uses random)
 */
function createId() {
  return uuid.v1();
}

/**
 * Sign an object with a secret by sha256 strategy
 * @param  {object} object - input object
 * @param  {String} secret
 * @return {String} hmac digested with hex
 */
function sign(object, secret) {
  const buffer = new Buffer(secret);
  const hmac = crypto.createHmac('sha256', buffer);

  hmac.update(JSON.stringify(sortObject(object)));
  return hmac.digest('hex');
}

/**
 * Validate signed object
 * @param  {Object} input - signed object with signature
 * @return {Promise -> signed object} return the input object if it passed
 */
function validateSignatures(input) {
  //console.info(`Validating input signature ${input.signature}`);

  // Verify that the data matches the signature
  const originalSignature = input.signature;
  const withoutSignature = Object.assign({}, input);
  delete withoutSignature.signature;

  const computedSignature = sign(withoutSignature, process.env.MAAS_SIGNING_SECRET);

  if (originalSignature === computedSignature) {
    delete input.signature; // NOTE should signature be deleted after validation?
    return Promise.resolve(input);
  }

  console.warn(`Validation failed. Current: ${originalSignature} Expected: ${computedSignature}`);

  // FIXME change routeId term
  return Promise.reject(new MaaSError('Signature validation failed.', 400));
}

/**
 * Remove signature from input object
 * @param {Object} input - input object
 * @return {Object} - input object without signature
 */
function removeSignatures(input) {
  delete input.signature;

  return input;
}

/**
 * Recursively removes nulls from a given object, leaving simple values as-is.
 * Does not affect the original object, but retuns a copy, instead.
 *
 * @param {Object} input - input object
 * @return {Object} - input object without signature
 */
function removeNulls(input) {
  // Return the simple value (non-object); Arrays are considered simple values,
  // even if their typeof returns object; note that nulls are objects; we
  // accept root-level nulls, but disallow them inside objects.
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  // Handle a complex case (Array): Remove nulls from nested objects
  if (Array.isArray(input)) {
    return input.map(removeNulls);
  }

  // Handle a complex case (Object)
  const output = {};
  Object.keys(input).forEach(key => {
    const value = input[key];

    if (value !== null) {
      output[key] = removeNulls(value);
    }
  });

  return output;
}

/**
 * Creates a deep copy of the object
 *
 * @param {object} object the Object to clone
 */
function cloneDeep(object) {
   // TODO Node 4.3 does not accept ES6 rest parameters
   // For now, delegate to lodash
  return _.cloneDeep(object);
}

/**
 * Performs a deep merge of two objects.
 *
 * @param {object} object The object to merge the values to
 * @param {object} [sources] Multiple sources to merge the values from
 */
function merge(object, delta) {

  // Handle the case of source not existing - just return the delta
  if (typeof object === typeof undefined) {
    return cloneDeep(delta);
  }

  // TODO Node 4.3 does not accept ES6 rest parameters
  // For now, delegate to lodash
  return _.merge(object, delta);
}

/**
 * Checks if the given value is empty string, null or undefined,
 * mainly for the purpose of validating API Gateway input
 *
 * @param value an arbitrary object
 * @return true if the value is empty string, undefined or null, false otherwise
 */
function isEmptyValue(value) {
  if (typeof value === typeof undefined || value === null || value === '') {
    return true;
  }

  return false;
}

module.exports = {
  getCognitoDeveloperIdentity,
  documentExist,
  parseSingleChargebeePlan,
  parseSingleChargebeeAddon,
  scheduleFunction,
  createId,
  sign,
  sortObject,
  validateSignatures,
  removeSignatures,
  removeNulls,
  isEmptyValue,
  merge,
  cloneDeep,
};
