'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Database = models.Database;
const Promise = require('bluebird');

function validateEvent( event ) {
  if (!event.partnerId) {
    return Promise.reject(new MaaSError('Missing partnerId', 400));
  }
  if (!event.auditorKey) {
    return Promise.reject(new MaaSError('Missing auditorKey', 400));
  }
  if ( ! event.startTime ) {
    event.startTime = new Date().getTime() - 1000 * 60 * 60 * 24;
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
      if ( ! partner || ! partner.auditorKey || event.auditorKey !== partner.auditorKey ) {
        return Promise.reject(new MaaSError('Invalid auditor key', 400));
      }
      return Promise.resolve(partner);
    } );
}

function fetchLogEntries( event, partner ) {
  return models.TicketAuditLog.query()
    .where('domainId', '=', partner.domainId)
    .where('created', '>=', new Date(event.startTime).toISOString())
    .where('created', '<', new Date(event.endTime).toISOString());
}

function formatLogEntries( entries ) {
  return entries;
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
