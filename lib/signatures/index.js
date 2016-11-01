'use strict';

const crypto = require('crypto');
const MaaSError = require('../errors/MaaSError');
const Promise = require('bluebird');
const sortObject = require('deep-sort-object');

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
    return Promise.resolve(input);
  }
  console.warn(`Validation failed. Current: ${originalSignature} Expected: ${computedSignature}`);

  return Promise.reject(new MaaSError('Signature validation failed.', 400));
}

module.exports = {
  sign,
  validateSignatures,
};
