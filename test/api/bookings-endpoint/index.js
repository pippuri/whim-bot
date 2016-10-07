'use strict';

const agencyOptionsTest = require('./feature-agency-options.js');
const bookingsRetrieveTest = require('./feature-bookings-retrieve');
const bookingsListTest = require('./feature-bookings-list');
const bookingsMaaSFullFlow = require('./feature-bookings-maas-full-flow');
const bookingsSixtFullFlowTest = require('./feature-bookings-Sixt-full-flow.js');

describe('bookings endpoint', function () {
  this.timeout(20000);

  const agencyOptionsLambda = require('../../../bookings/bookings-agency-options/handler.js');
  const bookingsCreateLambda = require('../../../bookings/bookings-create/handler.js');
  const bookingsCancelLambda = require('../../../bookings/bookings-cancel/handler.js');
  const bookingsRetrieveLambda = require('../../../bookings/bookings-retrieve/handler.js');
  const bookingsListLambda = require('../../../bookings/bookings-list/handler.js');

  describe.skip('bookings-agency-options', function () {
    this.timeout(20000);
    agencyOptionsTest(agencyOptionsLambda);
  });

  describe.skip('bookings-create', function () {
    this.timeout(20000);
  });

  describe.skip('bookings-cancel', function () {
    this.timeout(20000);
  });

  describe.skip('bookings-retrieve', function () {
    this.timeout(20000);
    bookingsRetrieveTest(agencyOptionsLambda, bookingsCreateLambda, bookingsRetrieveLambda);
  });

  describe.skip('bookings-list', function () {
    this.timeout(20000);
    bookingsListTest(agencyOptionsLambda, bookingsCreateLambda, bookingsListLambda);
  });

  describe.skip('bookings-Sixt-full-flow', function () {
    this.timeout(20000);
    bookingsSixtFullFlowTest(agencyOptionsLambda, bookingsCreateLambda, bookingsCancelLambda, bookingsRetrieveLambda);
  });

  describe('bookings-MaaS-full-flow', function () {
    this.timeout(20000);
    bookingsMaaSFullFlow(agencyOptionsLambda);
  });
});
