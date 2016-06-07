const crypto = require('crypto');
const uuid = require('node-uuid');

function sign(object, secret) {
  var buffer = new Buffer(secret);
  var hmac = crypto.createHmac('sha256', buffer);

  hmac.update(JSON.stringify(object));
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
};
