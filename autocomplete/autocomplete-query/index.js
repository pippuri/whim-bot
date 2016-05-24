const Promise = require('bluebird');
const bus = require('../../lib/service-bus');

module.exports.respond = function (event, callback) {

  // Validate & set defaults
  return new Promise((resolve, reject) => {
    const query = event.query;

    // Inject input hints
    if (typeof query.lat === 'number' && typeof query.lon === 'number') {
      query.hint = 'latlon';
    } else {
      query.hint = 'none';
    }

    resolve(query);
  })
  .then(query => bus.call('MaaS-provider-here-autocomplete', query))
  .then(results => {
    callback(null, results);
  })
  .catch(err => {
    console.warn('Error:', err.errors);

    // TODO Process the error
    callback(err);
  });
};
