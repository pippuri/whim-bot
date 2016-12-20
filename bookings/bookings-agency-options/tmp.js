'use strict';

/**
 *
 *  NOTE this is a temporary patch file for bookings-agency-options
 *  It helps fixing the issues with the lambda not being able to calculate
 *  the fare of the booking due to the lack of profile context
 *
 *  When new product concept is introduced to the system, use that here
 */

const Profile = require('../../lib/business-objects/Profile');
const models = require('../../lib/models');
const pricingRule = require('../../business-rule-engine/rules/get-routes/pricing');

/**
 * Fake leg location based on ticket name
 */
function fakeLocation(ticketName) {
  switch (ticketName) {
    case 'Helsinki':
      return { from: { lat: 60.169459, lon: 24.939264 }, to: { lat: 60.169459, lon: 24.939264 } };
    case 'Espoo':
      return { from: { lat: 60.222038, lon: 24.778649 }, to: { lat: 60.222038, lon: 24.778649 } };
    case 'Vantaa':
      return { from: { lat: 60.288451, lon: 25.041194 }, to: { lat: 60.288451, lon: 25.041194 } };
    case 'Sipoo':
      return { from: { lat: 60.376834, lon: 25.268333 }, to: { lat: 60.376834, lon: 25.268333 } };
    case 'Kerava':
      return { from: { lat: 60.401088, lon: 25.100933 }, to: { lat: 60.401088, lon: 25.100933 } };
    case 'Kirkkonummi':
      return { from: { lat: 60.123595, lon: 24.440610 }, to: { lat: 60.123595, lon: 24.440610 } };
    case 'Seutu':
      return { from: { lat: 60.169459, lon: 24.939264 }, to: { lat: 60.288451, lon: 25.041194 } };
    case 'Lähiseutu 2':
      return { from: { lat: 60.222038, lon: 24.778649 }, to: { lat: 60.123595, lon: 24.440610 } };
    case 'Lähiseutu 3':
      return { from: { lat: 60.169459, lon: 24.939264 }, to: { lat: 60.123595, lon: 24.440610 } };
    default:
      throw new Error(`500: HSL ticket named ${ticketName} is not available`);
  }
}
/**
 * Use the input HSL booking, formulate a shadow itinerary that use the booking as a ticket of its leg
 * and run it though the pricing file of business engine.
 */
function calculateHSLfare(tspResponse, identityId) {
  return models.Database.init()
    .then(() => Profile.retrieve(identityId))
    .then(profile => {
      const shadowItineraries = tspResponse.options.map(item => {
        return {
          startTime: item.leg.startTime,
          endTime: item.leg.endTime,
          legs: [{
            startTime: item.leg.startTime,
            endTime: item.leg.endTime,
            mode: item.leg.mode,
            from: fakeLocation(item.meta.HSL.ticketType.name).from,
            to: fakeLocation(item.meta.HSL.ticketType.name).to,
            agencyId: 'HSL',
          }],
        };
      });
      return pricingRule.resolveRoutesPrice(shadowItineraries, profile)
        .then(responseItineraries => {

          // Number of response itineries and input are equal, and position is kept
          responseItineraries.forEach((itinerary, index) => {
            tspResponse.options[index].leg.agencyId = 'HSL';
            tspResponse.options[index].fare = { amount: itinerary.fare.points, currency: 'POINT' };
          });
          return Promise.resolve(tspResponse.options);
        });
    })
    .then(response => {
      return models.Database.cleanup()
        .then(() => Promise.resolve(response));
    })
    .catch(error => {
      return models.Database.cleanup()
        .then(() => Promise.reject(error));
    });
}
module.exports = {
  calculateHSLfare,
};
