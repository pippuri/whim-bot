'use strict';

const lib = require('../lib/index');

function getPoints(serviceBus, identityId, parameters) {
  return serviceBus.call('MaaS-profile-info', { identityId: identityId })
  .then(profile => lib.getUserSpecificPrices(profile))
  .then(prices => {
    return Promise.resolve(prices);
  });
}

module.exports = {
  getPoints,
};
