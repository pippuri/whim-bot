'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const productData = require('./product-data.json');
const Pricing = require('../../lib/business-objects/Pricing');
const requestSchema = require('maas-schemas/prebuilt/maas-backend/bookings/bookings-agency-products/request.json');
const responseSchema = require('maas-schemas/prebuilt/maas-backend/bookings/bookings-agency-products/response.json');
const utils = require('../../lib/utils');
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');

function getAgencyProductOptions(event) {
  const products = utils.cloneDeep(productData[event.agencyId]);

  if (!products) {
    return Promise.reject(new MaaSError(`No product data for given agencyId '${event.agencyId}'`, 400));
  }

  // Convert euros to points; annotate agency id.
  return Promise.all(products.map(product => {
    const cost = product.cost;
    return Pricing.convertCostToPoints(parseFloat(cost.amount), cost.currency)
      .then(points => {
        const annotated = utils.cloneDeep(product);
        delete annotated.cost;
        // TODO: change to right format after client migrated!
        //annotated.fare = { amount: points, currency: 'POINT' };
        annotated.fare = points;
        return annotated;
      });
  }))
  .then(products => {
    return {
      agencyId: event.agencyId,
      products,
    };
  });
}

module.exports.respond = function (event, callback) {
  return Promise.resolve()
    .then(() => validator.validate(requestSchema, event))
    .catch(ValidationError, error => Promise.reject(new MaaSError(`Validation failed: ${error.message}`, 400)))
    .then(validated => getAgencyProductOptions(validated))
    .then(response => validator.validate(responseSchema, response))
    .catch(ValidationError, error => {
      console.warn('Warning; Response validation failed, but responding with success');
      console.warn('Errors:', error.message);
      console.warn('Response:', JSON.stringify(error.object, null, 2));
      return Promise.resolve(error.object);
    })
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
