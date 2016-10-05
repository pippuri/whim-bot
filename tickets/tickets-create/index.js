'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Database = models.Database;
const jwt = require('jsonwebtoken');
const utils = require('../../lib/utils');
const Promise = require('bluebird');
const request = require('request-promise-lite');

function validateEvent( event ) {
  if (!event.partnerId) {
    return Promise.reject(new MaaSError('Missing partnerId', 400));
  }
  if (!event.partnerKey) {
    return Promise.reject(new MaaSError('Missing partnerKey', 400));
  }

  if ( event.meta && typeof( event.meta ) !== 'object' ) {
    return Promise.reject(new MaaSError('Optional meta parameter must be an object', 400));
  }

  if (event.startTime && isNaN( event.startTime ) ) {
    return Promise.reject(new MaaSError('Input startTime should be an epoch', 400));
  }

  if (event.endTime && isNaN( event.endTime ) ) {
    return Promise.reject(new MaaSError('Input endTime should be an epoch', 400));
  }

  return 1;
}
function validatePartner( event ) {

  return models.TicketPartner.query().first()
    .where( 'partnerId', '=', event.partnerId )
    .then( partner => {
      if ( ! partner || ! partner.partnerKey || event.partnerKey !== partner.partnerKey ) {
        return Promise.reject(new MaaSError('Invalid partner key'));
      }
      return partner;
    } );
}

function getDomainIdForPartner( partner ) {
  let domainId = partner.domainId;
  if ( domainId === 'any' ) {
    domainId = event.domainId;
  }
  return domainId;
}

function createTicketPayload( event, partner ) {
  let domainId = partner.domainId;
  if ( domainId === 'any' ) {
    domainId = event.domainId;
  }
  const payload = {
    id: utils.createId(),
    domainId: getDomainIdForPartner( partner ),
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
  const logEntry = {
    id: payload.id,
    payload: payload,
    meta: event.meta,
    domainId: getDomainIdForPartner( partner ),
    partnerId: partner.partnerId,
  };

  console.log( 'Starting to store Audit Log:', logEntry );

  // TODO: inform all of the relevant webhooks about new data in the audit log

  return models.TicketAuditLog.query().insert( logEntry )
    .then( () => payload )
    .catch( () => {
      console.error( 'Failed to store to audit log:', logEntry );
      throw new MaaSError('Could not contact database for creating the ticket', 500);
    } );
}

function signPayload(payload) {
  const privateKey = require(`./keys/${process.env.SERVERLESS_STAGE}`).getKey();
  if (!privateKey) {
    throw new MaaSError('Unknown SERVERLESS_STAGE when initializing tickets-create', 500);
  }

  try {
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  } catch (error) {
    console.warn(`Error signing the message: payload='${JSON.stringify(payload)}', privateKey='${privateKey}'`);
    throw new MaaSError('Error signing the message', 500);
  }
}

// TODO: this should really use a queue instead of a hack like this.
function sendWebhookPingsAndCleanupDatabase( payload ) {
  return models.TicketPartner.query()
    .where('domainId', '=', payload.domainId )
    .then( domainPartners => {
      Database.cleanup()
        .then( () => {
          domainPartners.forEach( partner => {
            if ( partner.auditWebhookUrl ) {
              console.log(`Pinging partner ${partner.partnerId} at ${partner.auditWebhookUrl}`);
              request.post( partner.auditWebhookUrl, { json: true, body: { ping: 1 } } );
            }
          } );
        } );
    } );
}

module.exports.respond = (event, callback) => {

  return Database.init()
    .then( () => validateEvent( event ) )
    .then( () => validatePartner( event ) )
    .then( partner => [createTicketPayload( event, partner ), partner] )
    .spread( ( payload, partner ) => storeTicketAuditLog( event, payload, partner ) )
    .then( payload => [payload, signPayload( payload )] )
    .spread( ( payload, signedPayload ) => {
      callback(null, {
        ticketId: payload.id,
        ticket: signedPayload,
      } );

      Promise.resolve()
        .then( () => sendWebhookPingsAndCleanupDatabase( payload ) );
    } )
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      Database.cleanup()
      .then(() => {
        if (_error instanceof MaaSError) {
          callback(_error);
          return;
        }

        callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
      });
    });
};
