'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Database = models.Database;
const Promise = require('bluebird');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function validateEvent( event ) {
  if (!event.partnerId) {
    return Promise.reject(new MaaSError('Missing partnerId', 400));
  }
  if (!event.auditorKey) {
    return Promise.reject(new MaaSError('Missing auditorKey', 400));
  }
  if ( ! event.startTime ) {
    event.startTime = Date.now() - 1000 * 60 * 60 * 24;
  }
  if ( isNaN( event.startTime ) ) {
    return Promise.reject(new MaaSError('Input startTime should be a milli epoch', 400));
  }

  if ( ! event.endTime ) {
    event.endTime = event.startTime + 1000 * 60 * 60 * 24;
  }
  if ( isNaN( event.endTime ) ) {
    return Promise.reject(new MaaSError('Input endTime should be a milli epoch', 400));
  }
  return Promise.resolve();
}

function validatePartner( event ) {
  return models.TicketPartner.query().first()
    .where( 'partnerId', '=', event.partnerId )
    .then( partner => {
      if ( ! partner || ! partner.auditorKey || event.auditorKey !== partner.auditorKey || partner.domainId !== 'any' ) {
        return Promise.reject(new MaaSError('Invalid auditor key', 400));
      }
      return Promise.resolve(partner);
    } );
}

function fetchLogEntries( event, partner ) {
  return models.TicketAuditLog.query()
    .where('created', '>=', new Date(event.startTime).toISOString())
    .where('created', '<', new Date(event.endTime).toISOString());
}

function createObfuscatedDomainId(domainId) {
  const buffer = new Buffer('this1s0bfuscation5ecret');
  const hmac = crypto.createHmac('sha256', buffer);

  hmac.update(domainId);
  const digest = hmac.digest('hex');
  // take only the last 16 characters
  return digest.replace(/^.{48}/, '');
}

const domainObfuscatedIdMap = {};

function formatLogEntries( entries ) {
  const formattedEntries = [];

  entries.forEach( entry => {
    let obfuscatedId = domainObfuscatedIdMap[entry.domainId];
    if ( ! obfuscatedId ) {
      obfuscatedId = createObfuscatedDomainId(entry.domainId);
      domainObfuscatedIdMap[entry.domainId] = obfuscatedId;
    }

    const jwtToken = jwt.sign(entry, entry.id);

    // Strip out all but the signature:
    const signature = jwtToken.replace(/^[^\.]*\.[^\.]*\./, '');

    formattedEntries.push( {
      domain: obfuscatedId,
      signature: signature,
    } );
  } );
  return formattedEntries;
}

module.exports.respond = (event, callback) => {

  return Database.init()
    .then( () => validateEvent( event ) )
    .then( () => validatePartner( event ) )
    .then( partner => fetchLogEntries( event, partner ) )
    .then( entries => formatLogEntries( entries ) )
    .then( formattedEntries => {
      Database.cleanup()
        .then(() => callback(null, { log: formattedEntries } ));
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
