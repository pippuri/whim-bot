'use strict';

const agencyOptionsTest = require('./feature-agency-options.js');
const bookingsRetrieveTest = require('./feature-bookings-retrieve');

describe('bookings endpoint', function () {
  this.timeout(20000);

  agencyOptionsTest(require('../../../bookings/bookings-agency-options/handler.js'));
  bookingsRetrieveTest(require('../../../bookings/bookings-retrieve/handler.js'));
});
