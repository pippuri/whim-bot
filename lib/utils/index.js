const crypto = require('crypto');
const uuid = require('node-uuid');
const sortObject = require('deep-sort-object');

function sign(object, secret) {
  var buffer = new Buffer(secret);
  var hmac = crypto.createHmac('sha256', buffer);
  console.log('Sign:' + JSON.stringify(sortObject(object)));

  hmac.update(JSON.stringify(sortObject(object)));
  return hmac.digest('hex');
}

function createId() {
  // TODO Use users' public IP address or such for generating the first 6 bytes
  // (now uses random)
  return uuid.v1();
}

module.exports = {
  sign: sign,
  createId: createId,
  sortObject: sortObject,
};
