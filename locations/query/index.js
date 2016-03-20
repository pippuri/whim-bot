var Promise = require('bluebird');
var AWS = require('aws-sdk');
var AJV = require('ajv');

// Determine the schema to export
var schema = require('./schema.json');
var validate;

// Initialization work
(function init() {
  // Initialise AJV with the option to use defaults supplied in the schema
  var ajv = AJV({ inject: true, async: true });

  // Add a new handler
  ajv.addKeyword('inject', { 
    compile: function(schema) {
      if (!this._opts.inject) return function() { return true; }

      return function(data, dataPath, parentData, parentDataProperty) {
        for (key in schema) {
          if (typeof data[key] === 'undefined') {
            data[key] = schema[key];
          }
        }
        return true;
      };
    }
  });

  // Compile schema
  validate = ajv.compile(schema);

  // Promisify Lambda helpers
  var lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
  Promise.promisifyAll(lambda, { suffix: 'Promise' });
})();

function getLocation(input) {
  var locations = [{
      name: "Kamppi",
      address: "Urho Kekkosen katu 1",
      zipCode: "00100",
      city: "Helsinki",
      country: "Finland",
      lat: 60.1685348,
      lon: 24.9304942
    },
    {
      name: "Kamppi",
      address: "Tennispalatsinaukio 1",
      zipCode: "00100",
      city: "Helsinki",
      country: "Finland",
      lat: 60.168,
      lon: 24.93
    },
    {
      name: "Kampin kingit",
      address: "Urho Kekkosen katu 7B",
      zipCode: "00100",
      city: "Helsinki",
      country: "Finland",
      lat: 60.168,
      lon: 24.930
    }];


  return Promise.resolve({
    locations: locations,
    query: input
  });
}

module.exports.respond = function (event, callback) {
  // Validate & set defaults
  validate(event)
    .then(function valid() {
      return getLocation(event);
    })
    .then(function(results) {
      callback(null, results);
    })
    .catch(function (err) {
      console.warn('Validation errors:', err.errors);

      // TODO Process the error
      callback(err);
    });
};
