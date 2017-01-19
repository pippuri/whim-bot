'use strict';

const Promise = require('bluebird');
const objection = require('objection');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models/');
const utils = require('../../lib/utils/');
const stateMachine =  require('../../lib/states').StateMachine;
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');
const bus = require('../../lib/service-bus');

const requestSchema = require('maas-schemas/prebuilt/maas-backend/webhooks/webhooks-bookings-update/request.json');
const responseSchema = require('maas-schemas/prebuilt/maas-backend/webhooks/webhooks-bookings-update/response.json');

const LAMBDA_PUSH_NOTIFICATION_APPLE = 'MaaS-push-notification';

function parseAndValidateInput(event) {
  return validator.validate(requestSchema, event);
}

/**
 * Handle booking related data sent to Booking webhook agencyId, tspId and
 * payload.
 *
 * @static
 * @param {String} agencyId - agencyId of the requested booking
 * @param {String} tspId - provider id of the requested booking
 * @param {Object} payload - data from which the booking will be updated
 * @return {Promise -> Booking with updated data}
 */
function webhookCallback(agencyId, tspId, payload) {
  let trx;

  return objection.transaction.start(models.Booking)
    .then(transaction => {
      trx = transaction;

      return models.Booking.bindTransaction(trx)
        .query()
        .whereRaw('leg ->> \'agencyId\' = ?', [agencyId])
        .andWhere('tspId', tspId)
        // Sort by time newest to oldest (in case we have a duplicate tspId)
        .orderBy('created', 'desc');
    })
    .then(bookings => {
      const booking = bookings[0];

      if (!booking) {
        const message = `Booking with tspId ${tspId} not found`;
        return Promise.reject(new MaaSError(message, 404));
      }

      // It is ok if the booking stays in the same state
      if (booking.state !== payload.state &&
        !stateMachine.isStateValid('Booking', booking.state, payload.state)) {
        const message = `Booking state change from ${booking.state} to ${payload.state} is not permitted`;
        return Promise.reject(new MaaSError(message, 403));
      }

      return models.Booking.bindTransaction(trx)
        .query()
        .patchAndFetchById(booking.id, {
          cost: utils.merge(booking.cost, payload.cost),
          state: utils.merge(booking.state, payload.state),
          terms: utils.merge(booking.terms, payload.terms),
          token: utils.merge(booking.token, payload.token),
          meta: utils.merge(booking.meta, payload.meta),
          leg: utils.merge(booking.leg, payload.leg),
        });
    })
    .then(booking => trx.commit().then(() => booking))
    .catch(error => {
      return trx.rollback()
        .then(rollbackMessage => {
          console.warn('[Webhooks-Bookings-Update] transaction cancelled:', rollbackMessage);
          return Promise.reject(error);
        })
        .catch(rollbackError => {
          console.warn('[Webhooks-Bookings-Update] transaction rollback failed:', rollbackError.errorMessage);
          return Promise.reject(rollbackError);
        });
    });
}

function formatResponse(booking) {
  const sanitized = utils.sanitize(booking);

  delete sanitized.leg.agencyId;

  return {
    booking: {
      tspId: sanitized.tspId,
      cost: sanitized.cost,
      leg: sanitized.leg,
      state: sanitized.state,
      meta: sanitized.meta,
      terms: sanitized.terms,
      token: sanitized.token,
    },
    debug: {
    },
  };
}

function sendPushNotification(identityId, type, data, message) {
  console.info(`[Webhooks-Bookings-Update] Sending push notification to user ${identityId}: '${message || '(no message)'}'`);

  const event = {
    identityId: identityId,
    badge: 0,
    type,
    data,
    message,
  };

  return bus.call(LAMBDA_PUSH_NOTIFICATION_APPLE, event)
    .then(result => {
      console.info(`[Webhooks-Bookings-Update] Push notification to user ${identityId} sent, result:`, result);
    })
    .catch(err => {
      console.warn(`[Webhooks-Bookings-Update] Error: Failed to send push notification to user ${identityId}, err:`, err);
    });
}

module.exports.respond = (event, callback) => {
  let identityId;
  let bookingId;

  return models.Database.init()
    .then(() => parseAndValidateInput(event))
    .then(parsed => webhookCallback(parsed.agencyId, parsed.payload.tspId, parsed.payload))
    .then(updatedBooking => {
      identityId = updatedBooking.customer.identityId;
      bookingId = updatedBooking.id;
      return formatResponse(updatedBooking);
    })
    .then(updatedBooking => validator.validate(responseSchema, updatedBooking, { sanitize: true }))
    .then(response => {
      const payload = { ids: [bookingId], objectType: 'Booking' };

      return Promise.all([
        response,
        sendPushNotification(identityId, 'ObjectChange', payload),
      ]);
    })
    .spread(
      (response, pushResponse) => {
        return models.Database.cleanup()
        .then(() => callback(null, response));
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

          if (_error instanceof ValidationError) {
            callback(new MaaSError(`Validation failed: ${_error.message}`, 400));
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
