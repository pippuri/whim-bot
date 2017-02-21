'use strict';

const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const MaaSError = require('../../lib/errors/MaaSError');

/**
 * Migratory function to map country name to country code
 *
 * FIXME Fix client to send the country code
 */
function mapCountryToCode(country) {
  switch (country) {
    case 'Finland':
    case 'Suomi':
    case 'FI':
      return 'FI';
    default:
      throw new MaaSError('Unsupported country (expecting Finland)', 400);
  }
}

function updateUserData(event) {
  const identityId = event.identityId;
  const payload = event.payload;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new MaaSError('Input missing', 400));
  }

  if (!event.hasOwnProperty('payload')) {
    return Promise.reject(new MaaSError('Payload missing', 400));
  }

  if (typeof identityId !== 'string') {
    return Promise.reject(new MaaSError('Invalid or missing identityId', 400));
  }

  // FIXME Currently client sends the full country (Finland), we need code (FI)
  let country;
  try {
    country = mapCountryToCode(payload.country);
  } catch (error) {
    return Promise.reject(error);
  }

  const customer = {
    identityId: event.identityId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    zipCode: payload.zip,
    country: country,
    city: payload.city,
  };

  if (payload.card) {
    console.warn('Warning: Using card as a payment method - for tests only');
    // Credit card (should be only used for testing)
    customer.paymentMethod = {
      type: 'card',
      number: payload.card.number,
      cvv: payload.card.cvv,
      expiryMonth: Number.parseInt(payload.card.expiryMonth, 10),
      expiryYear: Number.parseInt(payload.card.expiryYear, 10),
    };
  } else if (payload.token) {
    customer.paymentMethod = {
      type: 'stripe',
      token: payload.token,
    };
  } else {
    return Promise.reject(new MaaSError('Missing payment method', 400));
  }

  // Note: Chargebee webhook (handled by SubscriptionManager) will eventually
  // update the customer data - hence we do not update it separately here.
  return SubscriptionManager.updateCustomer(customer);
}

function wrapToEnvelope(resp, event) {
  return {
    profile: resp,
  };
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return updateUserData(event)
    .then(response => wrapToEnvelope(response, event))
    .then(envelope => callback(null, envelope))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
