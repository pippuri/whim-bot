
var defaultServiceBus = require('../../lib/service-bus/index.js');

var Promise = require('bluebird');

var businessRuleDatabase = {
  plan1: {
    bus: true,
    taxi: false,
  },
  plan2: {
    bus: true,
    taxi: true,
  },
};

var providerRegions = {
  tripgo: [
    {
      area: [59.74, 22.65, 61.99, 30.24],
      subProvider: '-southfinland',
    },
    {
      area: [59.74, 19.31, 64.12, 29.93],
      subProvider: '-middlefinland',
    },
    {
      area: [61.72, 20, 70.36, 32.08],
      subProvider: '-northfinland',
    },
  ],
};

function isInsideRegion(coords, area) {
  return (area[0] <= coords[0] && coords[0] <= area[2] &&
    area[1] <= coords[1] && coords[1] <= area[3]);
}

function chooseProviderByRegion(provider, from) {
  var subProvider = '';
  var regions = providerRegions[provider];
  if (regions) {
    var coords = from.split(',').map(parseFloat);

    // Look for a sub-provider by matching region
    regions.map(function (region) {
      if (!subProvider && isInsideRegion(coords, region.area)) {
        subProvider = region.subProvider;
      }

    });

    if (!subProvider) {

      // Could not find a subprovider in the configured regions
      throw new Error('No provider found for region');
    }
  }

  return subProvider;
}

function resolveRoutesProvider(event, options) {
  return new Promise((resolve, reject) => {
    var provider;

    if (typeof options === typeof {} && options.hasOwnProperty('provider')) {
      provider = options.provider;
    } else {
      provider = 'tripgo';
    }

    var subProvider = chooseProviderByRegion(provider, event.from);
    var functionName = 'MaaS-provider-' + provider + '-routes' + subProvider;
    return resolve(functionName);
  });
}

module.exports = {
  call: (ruleObject, options) => {
    var serviceBus;

    if (typeof options === typeof {}) {
      if (typeof options.serviceBus === typeof defaultServiceBus) {
        serviceBus = options.serviceBus;
      } else {
        serviceBus = defaultServiceBus;
      }
    }

    serviceBus.call('MaaS-profile-info', { principalId: ruleObject.userId })
    .then((context) => console.log(context));

    if (ruleObject.rule === 'get-routes') {
      return resolveRoutesProvider(ruleObject.parameters, ruleObject.options)
      .then((service) => serviceBus.call(service, ruleObject.parameters));
    }

    return Promise.reject(new Error('unknown rule ' + ruleObject.rule));
  },
};
