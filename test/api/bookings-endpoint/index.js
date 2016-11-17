'use strict';

const agencyOptionsTest = require('./feature-agency-options.js');
const bookingsRetrieveTest = require('./feature-bookings-retrieve');
const bookingsListTest = require('./feature-bookings-list');
const bookingsMaaSFullFlow = require('./feature-bookings-maas-full-flow');
const bookingsHSLFullFlow = require('./feature-bookings-HSL-full-flow');
const bookingsSixtFullFlow = require('./feature-bookings-Sixt-full-flow.js');

describe('bookings endpoint', () => {
  const agencyOptionsLambda = require('../../../bookings/bookings-agency-options/handler.js');
  const bookingsCreateLambda = require('../../../bookings/bookings-create/handler.js');
  const bookingsCancelLambda = require('../../../bookings/bookings-cancel/handler.js');
  const bookingsRetrieveLambda = require('../../../bookings/bookings-retrieve/handler.js');
  const bookingsListLambda = require('../../../bookings/bookings-list/handler.js');

  describe.skip('bookings-agency-options', () => {
    agencyOptionsTest(agencyOptionsLambda);
  });

  describe.skip('bookings-create', () => {
  });

  describe.skip('bookings-cancel', () => {
  });

  describe.skip('bookings-retrieve', () => {
    bookingsRetrieveTest(agencyOptionsLambda, bookingsCreateLambda, bookingsRetrieveLambda);
  });

  describe.skip('bookings-list', () => {
    bookingsListTest(agencyOptionsLambda, bookingsCreateLambda, bookingsListLambda);
  });

  describe('bookings-Sixt-full-flow', () => {
    bookingsSixtFullFlow(agencyOptionsLambda, bookingsCreateLambda, bookingsCancelLambda, bookingsRetrieveLambda);
  });

  describe('bookings-HSL-full-flow', () => {
    bookingsHSLFullFlow(agencyOptionsLambda, bookingsCreateLambda, bookingsCancelLambda, bookingsRetrieveLambda);
  });

  // Skip this as MaaS ticket is not in use
  describe.skip('bookings-MaaS-full-flow', () => {
    bookingsMaaSFullFlow(agencyOptionsLambda);
  });
});
