'use strict';

const Promise = require('bluebird');
const localLambdaMap = {
  'MaaS-business-rule-engine': '../../business-rule-engine/handler.js',
  'MaaS-itinerary-retrieve': '../../itineraries/itinerary-retrieve/handler.js',
  'MaaS-bookings-agency-options': '../../bookings/bookings-agency-options/handler.js',
  'MaaS-profile-edit': '../../profile/profile-edit/handler.js',
  'MaaS-profile-info': '../../profile/profile-info/handler.js',
  'MaaS-provider-digitransit-routes': '../../provider-digitransit/provider-digitransit-routes/handler.js',
  'MaaS-provider-google-geocoding': '../../provider-google/provider-google-geocoding/handler.js',
  'MaaS-provider-google-reverse-geocoding': '../../provider-google/provider-google-reverse-geocoding/handler.js',
  'MaaS-provider-here-autocomplete': '../../provider-here/provider-here-autocomplete/handler.js',
  'MaaS-provider-here-geocoding': '../../provider-here/provider-here-geocoding/handler.js',
  'MaaS-provider-here-reverse-geocoding': '../../provider-here/provider-here-reverse-geocoding/handler.js',
  'MaaS-provider-here-routes': '../../provider-here/provider-here-routes/handler.js',
  'MaaS-provider-tripgo-regions': '../../provider-tripgo/provider-tripgo-regions/handler.js',
  'MaaS-provider-tripgo-routes': '../../provider-tripgo/provider-tripgo-routes/handler.js',
  'MaaS-provider-valopilkku-routes': '../../provider-valopilkku/provider-valopilkku-routes/handler.js',
  'MaaS-provider-twilio-send-sms': '../../provider-twilio/provider-twilio-send-sms/handler.js',
  'MaaS-routes-query': '../../routes/routes-query/handler.js',
  'MaaS-tracking-cancel-active-itinerary': '../../tracking/tracking-cancel-active-itinerary/handler.js',
  'MaaS-tracking-get-active-itinerary': '../../tracking/tracking-get-active-itinerary/handler.js',
  'MaaS-tracking-get-active-leg': '../../tracking/tracking-get-active-leg/handler.js',
  'MaaS-tracking-set-active-itinerary': '../../tracking/tracking-set-active-itinerary/handler.js',
  'MaaS-tracking-set-active-leg': '../../tracking/tracking-set-active-leg/handler.js',
  'MaaS-trip-invoke-decider': '../../trip/trip-invoke-decider/handler.js',
  'MaaS-trip-poll-decision': '../../trip/trip-poll-decision/handler.js',
  'MaaS-auth-sms-request-code': '../../auth/auth-sms-request-code/handler.js',
  'MaaS-auth-sms-login': '../../auth/auth-sms-login/handler.js',
};

function invokePromise(functionName, event) {

  // Check if we have a handler available
  const handlerPath = localLambdaMap[functionName];
  if (!handlerPath) {
    const message = `Missing local lambda mapping for ${functionName}.`;
    return Promise.reject(new Error(message));
  }

  // Execute inside a safe promise wrapper to catch runtime Errors
  return new Promise((resolve, reject) => {
    // Fetch the lambda & validate it is a valid function
    const lambda = require(handlerPath);

    if (typeof lambda.handler !== 'function') {
      const message = `Invalid Lambda handler ${functionName}, missing 'handler' function.`;
      reject(new Error(message));
    }

    const context = {
      done: (err, data) => {
        if (err !== null) {
          reject(err);
        }

        resolve(data);
      },
    };

    lambda.handler(event, context);
  });
}

function canCall(functionName) {
  return localLambdaMap.hasOwnProperty(functionName);
}

module.exports = {
  invokePromise: invokePromise,
  canCall: canCall,
};
