'use strict';

const MaaSError = require('../../lib/errors/MaaSError');

// Respond with a API version info at root
async function getApiVersion() {
  const response = await new Promise(resolve => {
    resolve({
      region: process.env.AWS_REGION,
      stage: process.env.SERVERLESS_STAGE,
      time: Date.now(),
    });
  });
  return response;
}

module.exports.respond = async function (event, callback) {
  try {
    const response = await getApiVersion();
    callback(null, response);
  } catch (error) {
    console.warn(`Caught an error: ${error.message}, ${JSON.stringify(error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(error.stack);

    // Uncaught, unexpected error
    if (error instanceof MaaSError) {
      callback(error);
      return;
    }

    callback(new MaaSError(`Internal server error: ${error.toString()}`, 500));
  }
};
