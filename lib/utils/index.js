var crypto = require('crypto');

function sign(object, secret) {
  var buffer = new Buffer(secret);
  var hmac = crypto.createHmac('sha256', buffer);

  hmac.update(JSON.stringify(object));
  return hmac.digest('hex');
}

module.exports = {
  sign: sign,
};
