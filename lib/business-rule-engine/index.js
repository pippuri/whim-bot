
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

module.exports = {
  get: (plans) => new Promise((resolve, reject) => {
    var policy = {
      bus: false,
      taxi: false,
    };
    for (var i of Object.keys(plans)) {
      var plan = plans[i];
      if (!businessRuleDatabase.hasOwnProperty(plan)) {
        return reject(new Error('Unknown plan: ' + plan));
      }

      var spec = businessRuleDatabase[plan];

      if (spec.bus === true) {
        policy.bus = true;
      }

      if (spec.taxi === true) {
        policy.taxi = true;
      }

    }

    return resolve(policy);
  }),
};
