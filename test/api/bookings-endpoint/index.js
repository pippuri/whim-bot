'use strict';

const agencyOptionsTest = require('./feature-agency-options.js');

describe('bookings endpoint', function () {
  this.timeout(20000);

  const lambda = require('../../../bookings/bookings-agency-options/handler.js');
  agencyOptionsTest(lambda);
});
