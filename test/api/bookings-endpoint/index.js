'use strict';

const agencyOptionsLambda = require('../../../bookings/bookings-agency-options/handler.js');
const bookingsRetrieveLambda = require('../../../bookings/bookings-retrieve/handler.js');
const bookingsCreateLambda = require('../../../bookings/bookings-create/handler.js');
const bookingsCancelLambda = require('../../../bookings/bookings-cancel/handler.js');

const agencyOptionsTest = require('./feature-agency-options.js');
const bookingsRetrieveTest = require('./feature-bookings-retrieve');
const bookingSixtFullFlow = require('./feature-bookings-Sixt-full-flow.js');

describe('bookings endpoint', function () {
  this.timeout(20000);

  agencyOptionsTest(agencyOptionsLambda);

  bookingsRetrieveTest(bookingsRetrieveLambda);

  bookingSixtFullFlow(agencyOptionsLambda, bookingsCreateLambda, bookingsCancelLambda, bookingsRetrieveLambda);

  // bookingsLambdaOcrldTest();
  require('./feature-bookings-lambda-ocrld-maas')();
});
