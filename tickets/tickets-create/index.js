'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Database = models.Database;
const jwt = require('jsonwebtoken');
const utils = require('../../lib/utils');
const Promise = require('bluebird');

const devTicketIssuers = [];

let privateKey;

if ( process.env.SERVERLESS_STAGE === 'dev' || process.env.SERVERLESS_STAGE === 'test' || process.env.SERVERLESS_STAGE === 'alpha') {
  privateKey = require('./keys/dev').key;
} else if ( ( '' + process.env.SERVERLESS_STAGE.indexOf('prod') ) === 0) {
  // TODO: add a separate prod file
  // privateKey = require('./keys/prod').key;
  privateKey = require('./keys/dev').key;
} else {
  throw new Error( 'Unknown SERVERLESS_STAGE' );
}

function validateEvent( event ) {
  // TODO: validation
  return 1;
}
function validateIssuer( event ) {

  // TODO: TicketIssuer database
  //return models.TicketIssuer.query().first()
  //  .where( 'issuerId', event.issuerId )

  return Promise.resolve( devTicketIssuers )
    .then( issuers => issuers.filter( i => i.issuerId === event.issuerId )[0] )
    .then( issuer => {
      if ( ! issuer || event.issuerKey !== issuer.issuerKey ) {
        return Promise.reject(new MaaSError('Invalid issuer key'));
      }
      return true;
    } );
}

function createTicketPayload( event ) {
  const payload = {
    id: utils.createId(),
  };

  const keys = [
    'startTime',
    'endTime',
    'from',
    'to',
    'ownerName',
    'custom',
  ];

  keys.forEach( key => {
    if ( event[key] || event[key] === 0 ) {
      payload[key] = event[key];
    }
  } );

  return payload;
}
function storeTicketAuditLog( event, payload ) {
  const logEntry = Object.assign( {}, payload, { meta: event.meta, issuerId: event.issuerId } );
  console.log( 'AUDIT_LOG', logEntry );
  // TODO: TicketAuditLog database

  /*
  return models.TicketAuditLog.query().insert( logEntry )
    .then( () => payload );
    */
  return payload;
}

function signPayload( payload ) {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

module.exports.respond = (event, callback) => {

  return Database.init()
    .then( () => validateEvent( event ) )
    .then( () => validateIssuer( event ) )
    .then( () => createTicketPayload( event ) )
    .then( payload => storeTicketAuditLog( event, payload ) )
    .then( payload => [payload, signPayload( payload )] )
    .spread( ( payload, signedPayload ) => {
      Database.cleanup()
        .then(() => callback(null, {
          ticketId: payload.id,
          ticket: signedPayload,
        } ));
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

devTicketIssuers.push( {
  issuerId: 'HSL',
  issuerKey: 'secret!',
} );

devTicketIssuers.push( {
  issuerId: 'MAAS',
  issuerKey: 'secret!2',
} );
