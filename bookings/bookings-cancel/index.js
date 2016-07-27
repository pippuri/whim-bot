'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const tsp = require('../../lib/tsp');
const Database = models.Database;
const stateMachine = require('../../lib/states/index').StateMachine;

module.exports.respond = (event, callback) => {

  if ( ! event.identityId ) {
    return callback(new MaaSError('Missing identityId', 400));
  }

  return Promise.resolve(Database.init())
    .then(() => models.Booking.query().findById(event.bookingId))
    .then(booking => {
      if (!booking ) {
        const message = `No booking found with bookingId '${event.bookingId}'`;
        return Promise.reject(new MaaSError(message, 404));
      }
      // TODO: identityId is not in customer so we can't verify this!
      /*
      if ( booking.customer.identityId !== event.identityId) {
        const message = `No booking found with bookingId '${event.bookingId}'`;
        return Promise.reject(new MaaSError(message, 404));
      }
      */

      return Promise.all([
        tsp.cancelBooking(booking),
        booking,
      ]);
    })
    .spread((cancelResponse, booking) => {
      if ( cancelResponse.state === 'CANCELLED') {
        const old_state = booking.state || 'START';
        booking.state = 'CANCELLED';
        if ( cancelResponse.meta && cancelResponse.meta.cancellationFee ) {
          booking.meta = Object.assign( booking.meta || {}, { cancellationFee: cancelResponse.meta.cancellationFee } );
        }
        return stateMachine.changeState('Booking', booking.id, old_state, booking.state)
          .then( () => {
            return models.Booking.query()
              .updateAndFetchById(booking.id, booking);
          } );
      }
      return Promise.reject('500: Cancellation failed unexpectedly: ' + JSON.stringify(cancelResponse) );
    })
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

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
