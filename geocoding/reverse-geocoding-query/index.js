const Promise = require('bluebird');
const bus = require('../../lib/service-bus');

module.exports.respond = function (event, callback) {

  // Validate & set defaults
  return new Promise((resolve, reject) => {
    const query = event.query;

    // Inject input hints, typecast input
    query.lat = parseFloat(query.lat);
    query.lon = parseFloat(query.lon);

    // Default to Finnish names
    if (typeof query.lang !== 'string') {
      query.lang = 'fi';
    }

    resolve(query);
  })
  .then(query => bus.call('MaaS-provider-google-reverse-geocoding', query))
  .then(results => {
    callback(null, results);
  })
  .catch(_error => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));

    // Uncaught, unexpected error
    const error = new Error('500: Internal server error: ' + _error.toString());

    callback(error);
  });
};
