var Promise = require('bluebird');
var AWS = require('aws-sdk');
var request = require('../../lib/hacks/maas-request-promise');
var routeRandomizer = require('./route-randomizer');
var routeNavigator = require('./route-navigator');

var iotData = new AWS.IotData({ region:process.env.AWS_REGION, endpoint:process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

// Simulate this user range
var START_USER = 29210000;
var END_USER = 29210009;

function loginSimulatedUser(phone) {
  return request.get('https://api.dev.maas.global/auth/sms-login', {
    qs: {
      phone: phone,
      code: '292',
    },
    json: true,
  });
}

function simulateUser(phone) {
  var thingName;
  var state;
  var identityId;
  var idToken;

  return loginSimulatedUser(phone)
  .then(function (response) {
    //console.log('Simulating user', phone, response.cognito_id);
    // Read the current state from user's Thing Shadow
    thingName = response.cognito_id.replace(/:/, '-');
    identityId = response.cognito_id;
    idToken = response.id_token;
    return iotData.getThingShadowAsync({
      thingName: thingName,
    });
  })
  .then(function (response) {
    var payload = JSON.parse(response.payload);
    state = payload.state.reported || {};
  })
  .then(null, function (err) {
    if (err.code === 'ResourceNotFoundException') {
      console.log('Note: Thing', thingName, 'does not have a thing shadow yet');
      state = {};
    } else {
      return Promise.reject(err);
    }
  })
  .then(function () {
    if (state.activeRoute) {
      // Route is active, continue it.
      return routeNavigator.continueExistingRoute(identityId, idToken, state.activeRoute);
    } else {
      // No route is active, start one.
      return routeRandomizer.startRandomRoute(identityId, idToken);
    }
  });
}

function simulateUserRoutes() {
  function simulateNext(phone) {
    if (phone > END_USER) {
      return Promise.resolve();
    }

    return simulateUser(phone)
    .then(() => simulateNext(phone + 1));
  }

  return simulateNext(START_USER);
}

module.exports.respond = function (event, callback) {
  simulateUserRoutes()
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
