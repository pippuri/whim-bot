'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models/');
const utils = require('../../lib/utils/');
const stateMachine =  require('../../lib/states');

// TODO request schemas validation
function validateInput(event) {
  if (!event.agencyId) {
    return Promise.reject(new MaaSError('Missing agencyId in input', 400));
  }

  if (!event.payload || Object.keys(event.payload).length === 0) {
    return Promise.reject(new MaaSError('Missing or empty payload', 400));
  }

  if (!event.payload.tspId) {
    return Promise.reject(new MaaSError('Missing tspId in payload', 400));
  }

  return Promise.resolve();
}

/**
 * Handle booking related data sent to Booking webhook
 * for agencyId, tspId. The tsp adapter will receive webhook
 * calls from the actual tsp in the future to update the booking to replace the current polling
 * @static
 * @param {String} agencyId - agencyId of the requested booking
 * @param {String} tspId - provider id of the requested booking
 * @param {Object} payload - data from which the booking will be updated
 * @return {Promise -> Booking with updated data}
 */
function webhookCallback(agencyId, tspId, payload) {

  if (!agencyId) return Promise.reject(new MaaSError('Missing agencyId in input', 400));
  if (!tspId) return Promise.reject(new MaaSError('Missing agencyId in input', 400));
  if (!payload) return Promise.reject(new MaaSError('Missing agencyId in input', 400));
  if (!payload.cost || Object.keys(payload.cost).length === 0) return Promise.reject(new MaaSError('Payload missing cost input', 400));
  if (!payload.state) return Promise.reject(new MaaSError('Payload missing state input', 400));
  if (!payload.terms) return Promise.reject(new MaaSError('Payload missing terms input', 400));
  if (!payload.token) return Promise.reject(new MaaSError('Payload missing token input', 400));
  if (!payload.meta) return Promise.reject(new MaaSError('Payload missing meta input', 400));

  let trx;

  return this.startTransaction()
    .then(transaction => {
      trx = transaction;
      return models.Booking.bindTransaction(trx)
        .query()
        .whereRaw('leg ->> \'agencyId\' = ?', [agencyId])
        .andWhere('tspId', tspId)
        .orderBy('created', 'desc') // Sort by time newest to oldest (Rarely does the tspId stay the same in a short period of time)
        .then(bookings => {
          const targetedBooking = bookings[0];
          if (!targetedBooking) return Promise.reject(new MaaSError(`Booking with tspId ${tspId} not found`, 404));
          if (!stateMachine.isStateValid('Booking', targetedBooking.state, payload.state)) {
            return Promise.reject(new MaaSError(`Booking state changing from ${targetedBooking.state} to ${payload.state} is not permitted`, 403));
          }
          return models.Booking.bindTransaction(trx)
            .query()
            .patch({
              cost: utils.merge(targetedBooking.cost, payload.cost),
              state: utils.merge(targetedBooking.state, payload.state),
              terms: utils.merge(targetedBooking.terms, payload.terms),
              token: utils.merge(targetedBooking.token, payload.token),
              meta: utils.merge(targetedBooking.meta, payload.meta),
            })
            .where('id', targetedBooking.id)
            .returning('*');
        });
    })
    .then(bookings => {
      return trx.commit()
        .then(() => bookings[0]);
    })
    .catch(e => {
      return trx.rollback()
        .then(rollbackMessage => {
          console.log(rollbackMessage);
          return Promise.reject(e);
        });
    });
}

module.exports.respond = (event, callback) => {
  return validateInput(event)
    .then(() => models.Database.init())
    .then(() => webhookCallback(event.agencyId, event.payload.tspId, event.payload))
    .then(updatedBooking => {
      models.Database.cleanup()
        .then(() => callback(null, updatedBooking));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      models.Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
