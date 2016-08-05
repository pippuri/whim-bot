'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Database = models.Database;

const publicKeys = { dev: [], prod: [] };

module.exports.respond = (event, callback) => {

  return Database.init()
    //.then(() => Database.knex.select().from('TicketKey'))
    .then( keys => {
      // NOTE: substitute hardcoded stage keys until we have a proper db
      keys = publicKeys[process.env.SERVERLESS_STAGE];
      Database.cleanup()
        .then(() => callback(null, { keys: keys || [] } ));
    } )
    .catch( error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      Database.cleanup()
        .then(() => {
          if (error instanceof MaaSError) {
            callback(error);
            return;
          }
          callback(new MaaSError(`Internal server error: ${error.toString()}`, 500));
        });
    });
};

publicKeys.dev.push( {
  validityStartMilliEpoch: 0,
  validityEndMilliEpoch: 1735682400000, // 2025
  publicKey: [
    '-----BEGIN PUBLIC KEY-----',
    'MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhANLriSaQ1mE4QSRusJ8AxqDNc98Wuvsd',
    'VK7o2j4ST3Yvh5amStJPpmYfzRJ5vo3bzU0rRcZhO9ez9YsO9hP1QGGYnjTqKuSN',
    'eMAKFhJ6Xew88q8OkvxMvsZbtQwQYTs0QwIDAQAB',
    '-----END PUBLIC KEY-----',
  ].join('\n'),
} );
