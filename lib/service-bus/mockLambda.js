'use strict';

const wrap = require('lambda-wrapper').wrap;
const Promise = require('bluebird');
const fs = require('fs');
const tempfile = require('tempfile');
const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);
const removeFile = Promise.promisify(fs.unlink);
const child_process = require('child_process');

const localLambdaMap = {
  'MaaS-provider-digitransit-routes': '../../provider-here/provider-here-routes/handler.js',
  'MaaS-provider-here-routes': '../../provider-here/provider-here-routes/handler.js',
  'MaaS-provider-tripgo-regions': '../../provider-tripgo/provider-tripgo-regions/handler.js',
  'MaaS-provider-tripgo-routes': '../../provider-tripgo/provider-tripgo-routes/handler.js',
  'MaaS-profile-info': '../../profile/profile-info/handler.js',
  'MaaS-profile-edit': '../../profile/profile-edit/handler.js',
  'MaaS-profile-create': '../../profile/profile-create/handler.js',
  'MaaS-store-single-package': '../../store/store-single-package/handler.js',
  'MaaS-provider-here-autocomplete': '../../provider-here/provider-here-autocomplete/handler.js',
  'MaaS-provider-google-reverse-geocoding': '../../provider-google/provider-google-reverse-geocoding/handler.js',
  'MaaS-tracking-set-active-leg': '../../tracking/tracking-set-active-leg/handler.js',
  'MaaS-tracking-get-active-leg': '../../tracking/tracking-get-active-leg/handler.js',
  'MaaS-tracking-set-active-itinerary': '../../tracking/tracking-set-active-itinerary/handler.js',
  'MaaS-tracking-get-active-itinerary': '../../tracking/tracking-get-active-itinerary/handler.js',
  'MaaS-tracking-cancel-active-itinerary': '../../tracking/tracking-cancel-active-itinerary/handler.js',
  'MaaS-trip-invoke-decider': '../../trip/trip-invoke-decider/handler.js',
  'MaaS-trip-poll-decision': '../../trip/trip-poll-decision/handler.js',
  'MaaS-itinerary-retrieve': '../../initerary/itinerary-retrieve/handler.js',
};

const localRepositoryLambdaMap = {};

function loadLocalMaasRepositoryLambdas( env, defaultPath, project, functionMap ) {
  const localPath = process.env[env] || defaultPath;

  try {
    if ( ! fs.accessSync( localPath, fs.R_OK ) ) {
      const localMap = {};
      Object.keys(functionMap).forEach( service => {
        functionMap[service].forEach( fn  => {
          const fullFn = service + '-' + fn;
          localMap[project + '-' + fullFn] = {
            dir: localPath,
            functionName: fullFn,
          };
        } );
      } );

      Object.assign(localRepositoryLambdaMap, localMap);
    }
  } catch (error) {
    if ( process.env[env] ) {
      console.error( 'Failed to mock lambdas through local transport_booking repository even though env.' + env + ' was set:', error );
    }
  }
}

if ( process.env.maas_test_run && process.env.TEST_WITH_LOCAL_TSP ) {
  loadLocalMaasRepositoryLambdas( 'LOCAL_MAAS_TRANSPORT_BOOKING_PATH', '../maas-transport-booking', 'maas-transport', {
    'booking-iq': ['create', 'get'],
    'booking-sixt': ['create', 'options-retrieve', 'retrieve', 'update', 'cancel'],
    'booking-maas': ['create', 'agency-options'],
    'booking-taxi': ['create', 'retrieve', 'update'],
    'booking-hsl-maas': ['create', 'retrieve', 'cancel'],
  } );
}

function invokePromise(functionName, event) {
  return new Promise((resolve, reject) => {
    if (!localLambdaMap.hasOwnProperty(functionName) && !localRepositoryLambdaMap.hasOwnProperty(functionName)) {
      reject(new Error('Missing local lambda mapping for ' + functionName + '.'));
      return;
    }

    if ( localRepositoryLambdaMap.hasOwnProperty(functionName) ) {
      // TODO: proper logging
      // log_debug( 'invoking local repository function ', functionName )

      const eventFile = tempfile('.json');
      const resultFile = tempfile('.json');

      writeFile(eventFile, JSON.stringify(event))
        .then( () => {
          return new Promise( (_resolve, _reject) => {
            child_process.exec( `sls function integration-run -s dev ${localRepositoryLambdaMap[functionName].functionName} ${eventFile} ${resultFile} > /dev/null`,
              {
                cwd: localRepositoryLambdaMap[functionName].dir,
              },
              ( error, stdout, stderr ) => {
                if ( error ) {
                  throw error;
                }
                return _resolve();
              }
            );
          } );
        } )
        .then( () => readFile(resultFile, { encoding: 'utf8' } ) )
        .then( result => {
          return removeFile(eventFile)
            .then(() => removeFile(resultFile))
            .then(() => result );
        } )
        .then( result => {
          const resultData = JSON.parse( result );
          if ( resultData.status === 'success' ) {
            return resolve( resultData.response );
          }
          return reject( resultData.response );
        } );

      return;
    }

    // TODO: proper logging
    // log_debug( 'invoking local function ', functionName )

    const handlerPath = localLambdaMap[functionName];
    const lambda = require(handlerPath);

    wrap(lambda).run(event, (err, data) => {
      if (err !== null) {
        return reject(err);
      }

      return resolve(data);
    });
  });
}

function canCall(functionName) {
  return localLambdaMap.hasOwnProperty(functionName) || localRepositoryLambdaMap.hasOwnProperty(functionName);
}

module.exports = {
  invokePromise: invokePromise,
  canCall: canCall,
};
