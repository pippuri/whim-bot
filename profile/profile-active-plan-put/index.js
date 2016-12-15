'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError.js');
const Database = require('../../lib/models/Database');
const Profile = require('../../lib/business-objects/Profile');
const Transaction = require('../../lib/business-objects/Transaction');

function validate(event) {
  if (Object.keys(event).length === 0) {
    return Promise.reject(new MaaSError('Missing input keys', 400));
  }

  if (event.identityId === '' || !event.hasOwnProperty('identityId')) {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (event.planId === '' || !event.hasOwnProperty('planId')) {
    return Promise.reject(new MaaSError('Missing planId', 400));
  }

  if (event.promoCode === '' || typeof event.promoCode === 'undefined') {
    event.promoCode = undefined;
  }

  if (event.skipUpdate !== '' && typeof event.skipUpdate !== 'undefined') {
    event.skipUpdate = true;
  } else {
    event.skipUpdate = false;
  }

  return Promise.resolve(event);
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => validate(event))
    .then(validated => {
      const identityId = validated.identityId;
      const planId = validated.planId;
      const promoCode = validated.promoCode;
      const transaction = new Transaction();

      return transaction.start()
        .then(() => Profile.retrieve(identityId))
        .then(oldProfile => {
          return Profile.updateSubscription(identityId, planId, transaction,  promoCode)
            .then(updatedProfile => {
              const balanceChange = updatedProfile.balance - oldProfile.balance;
              const promoMessage = promoCode ? ` (promotion code ${promoCode})` : '';
              const message = `Update subscription to ${planId}${promoMessage}; change point balance by ${balanceChange} points`;

              return transaction.commit(message, identityId, balanceChange);
            });
        })
        .catch(error => {
          return transaction.rollback()
            .then(() => Promise.reject(error));
        });
    })
    .then(profile => {
      Database.cleanup()
        .then(() => callback(null, profile));
    })
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
