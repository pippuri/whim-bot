'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Database = models.Database;
const jwt = require('jsonwebtoken');
const utils = require('../../lib/utils');
const Promise = require('bluebird');

let privateKey;

if ( process.env.SERVERLESS_STAGE === 'dev' || process.env.SERVERLESS_STAGE === 'test' || process.env.SERVERLESS_STAGE === 'alpha') {
  privateKey = require('./keys/dev').getKey();
} else if ( ( '' + process.env.SERVERLESS_STAGE ).indexOf('prod') === 0) {
  privateKey = require('./keys/prod').getKey();
} else {
  throw new Error( 'Unknown SERVERLESS_STAGE when initializing tickets-create' );
}

function validateEvent( event ) {
  if (!event.partnerId) {
    return Promise.reject(new MaaSError('Missing partnerId', 400));
  }
  if (!event.partnerKey) {
    return Promise.reject(new MaaSError('Missing partnerKey', 400));
  }

  if ( event.meta && ! typeof( event.meta ) !== 'object' ) {
    return Promise.reject(new MaaSError('Optional meta parameter must be an object', 400));
  }

  return 1;
}
function validatePartner( event ) {

  return models.TicketPartner.query().first()
    .where( 'partnerId', event.partnerId )
    .then( partner => {
      if ( ! partner || ! partner.partnerKey || event.partnerKey !== partner.partnerKey ) {
        return Promise.reject(new MaaSError('Invalid partner key'));
      }
      return partner;
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
function storeTicketAuditLog( event, payload, partner ) {
  let domainId = partner.domainId;
  if ( domainId === 'any' ) {
    domainId = event.domainId;
  }
  const logEntry = { id: payload.id, payload: payload, meta: event.meta, domainId: partner.domainId, partnerId: partner.partnerId };

  console.log( 'Starting to store Audit Log:', logEntry );

  // TODO: inform all of the relevant webhooks about new data in the audit log

  return models.TicketAuditLog.query().insert( logEntry )
    .then( () => payload )
    .catch( () => {
      console.error( 'Failed to store to audit log:', logEntry );
      throw new MaaSError('Could not contact database for creating the ticket', 500);
    } );
}

function signPayload( payload ) {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

module.exports.respond = (event, callback) => {

  return Database.init()
    .then( () => validateEvent( event ) )
    .then( () => validatePartner( event ) )
    .then( partner => [createTicketPayload( event ), partner] )
    .spread( ( payload, partner ) => storeTicketAuditLog( event, payload, partner ) )
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
