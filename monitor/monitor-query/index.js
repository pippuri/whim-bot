'use strict';

var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iot = new AWS.Iot({ region: process.env.AWS_REGION });
Promise.promisifyAll(iot);

var iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function getMonitorState() {

  // Retrieve as many things as we can
  var userState = {};
  return iot.listThingsAsync({
  })
  .then(response => {
    var promise = Promise.resolve();

    // Consider only things that have a phone number configured (users or simulated users)
    // var users = response.things.filter(thing => !!thing.attributes.phone); - not in use

    // Load state from thing shadows
    response.things.map(thing => {
      promise = promise.then(() => (
        iotData.getThingShadowAsync({
          thingName: thing.thingName,
        })
        .then(response => {
          if (response.payload) {
            var payload = JSON.parse(response.payload);
            if (payload.state.reported) {
              userState[thing.thingName] = {
                state: payload.state.reported,
                phone: thing.attributes.phone,
                type: thing.attributes.type,
              };
            }

          }

        })
        .then(null, err => {

          // No shadow for this thing.
        })
      ));
    });
    return promise;
  })
  .then(() =>  userState);
}

module.exports.respond = function (event, callback) {
  getMonitorState()
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
