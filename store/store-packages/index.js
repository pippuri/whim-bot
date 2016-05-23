// Require dependency
var SubscriptionMgr = require('../../lib/subscription-manager');

module.exports.respond = function (event, callback) {
  SubscriptionMgr.getProducts()
  .then(function (response, resp) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
