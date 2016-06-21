'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');

const iot = new AWS.Iot({ region: process.env.AWS_REGION });
Promise.promisifyAll(iot);

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function getMonitorState() {

  // Retrieve as many things as we can
  const userState = {};
  return iot.listThingsAsync({
  })
  .then(response => {
    let promise = Promise.resolve();

    // Consider only things that have a phone number configured (users or simulated users)
    // const users = response.things.filter(thing => !!thing.attributes.phone); - not in use

    // Load state from thing shadows
    response.things.map(thing => {
      promise = promise.then(() => (
        iotData.getThingShadowAsync({
          thingName: thing.thingName,
        })
        .then(response => {
          if (response.payload) {
            const payload = JSON.parse(response.payload);
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
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
