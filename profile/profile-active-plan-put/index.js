'use strict';

const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError.js');
const Profile = require('../../lib/business-objects/Profile');
const Promise = require('bluebird');
const schema = require('maas-schemas/prebuilt/maas-backend/profile/profile-active-plan-put/request.json');
const Transaction = require('../../lib/business-objects/Transaction');
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');

module.exports.respond = (event, callback) => {
  const validationOptions = {
    coerceTypes: true,
    useDefaults: true,
    sanitize: true,
  };

  return Database.init()
    .then(() => validator.validate(schema, event, validationOptions))
    .then(validated => {
      const identityId = validated.identityId;
      const planId = validated.planId;
      const promoCode = validated.promoCode;
      const transaction = new Transaction(identityId);

      return transaction.start()
        .then(() => Profile.issueSubscriptionChange(identityId, planId, transaction,  promoCode))
        .then(updatedProfile => {
          const promoMessage = promoCode ? ` (promotion code ${promoCode})` : '';

          return transaction.commit(`Issued subscription change to ${planId}${promoMessage}`);
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

          if (_error instanceof ValidationError) {
            callback(new MaaSError(_error.message, 400));
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
