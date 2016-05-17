
var Promise = require('bluebird');

var DEFAULT_CONTEXT = {
  activePlans: ['plan1'],
};

// TODO add this somewhere else and delete this file
var userDatabase = {
  'eu-west-1:00000000-cafe-cafe-cafe-000000000000': {
    activePlans: ['plan1', 'plan2'],
  },
};

module.exports = {
  get: (principalId) => new Promise((resolve, reject) => {
    if (userDatabase.hasOwnProperty(principalId)) {
      return resolve(userDatabase[principalId]);
    }

    return resolve(DEFAULT_CONTEXT);
  }),
};
