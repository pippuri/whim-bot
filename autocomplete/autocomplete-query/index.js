const Promise = require('bluebird');
const bus = require('../../lib/service-bus');

module.exports.respond = function (event, callback) {

  // Validate & set defaults
  return new Promise((resolve, reject) => {
    const query = event.query;

    // Inject input hints, typecast input
    if (typeof query.lat === 'string' && typeof query.lon === 'string') {
      query.lat = parseFloat(query.lat);
      query.lon = parseFloat(query.lon);
      query.hint = 'latlon';
    } else {
      query.hint = 'none';
    }

    if (typeof query.count === 'string') {
      query.count = parseInt(query.count, 10);
    }

    resolve(query);
  })
  .then(query => bus.call('MaaS-provider-here-autocomplete', query))
  .then(results => {
    callback(null, results);
  })
  .catch(err => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn('Error:', err.stack);

    // TODO Process the error
    callback(err);
  });
};
