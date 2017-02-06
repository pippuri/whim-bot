'use strict';

// Use mock lambdas (has to be set before requiring service bus)
process.env.USE_MOCK_LAMBDA = true;

const bus = require('../lib/service-bus');
const models = require('../lib/models');
const Promise = require('bluebird');
const script = require('commander');

const CUSTOMER_RETRIEVE = 'MaaS-subscriptions-customer-retrieve';

const MISSING_PAYMENT_METHOD = {
  type: 'unknown',
  valid: false,
};

const ANSI_RESET = '\u001B[0m';
const ANSI_RED = '\u001B[31m';
const ANSI_GREEN = '\u001B[32m';
const ANSI_YELLOW = '\u001B[33m';
const ANSI_CYAN = '\u001B[36m';

const green = s => `${ANSI_GREEN}${s}${ANSI_RESET}`;
const yellow = s => `${ANSI_YELLOW}${s}${ANSI_RESET}`;
const red = s => `${ANSI_RED}${s}${ANSI_RESET}`;
const cyan = s => `${ANSI_CYAN}${s}${ANSI_RESET}`;


// Read command line arguments
script.version('0.0.1')
  .description('Update postgres Profile.paymentMethod field based on Chargebee customer data')
  .option('-s, --stage [stage]', 'Choose a stage *required*')
  .option('--dry-run', 'Do not update the database, perform read-only operations')
  .option('--force-404', 'Force 404 customers to be updated with a valid "missing" paymentMethod')
  .option('--skip-test-users', 'Do not try to update profiles which are detected as test users')
  .parse(process.argv);

if (!script.stage) {
  console.log('You must specify a stage');
  script.outputHelp();
  process.exit(1);
} else {
  console.log('');
  console.log('Updating Profiles');
  console.log('============================================================================');
  console.log('');
}


// Read in the serverless environment
const variableFile = require(`../_meta/variables/s-variables-${script.stage}.json`);
// eslint-disable-next-line
for (const props in variableFile) {
  process.env[props] = variableFile[props];
}


// Initialize some counters for keeping track of activity
let postgresProfilesTotal = 0;
let postgresProfilesSkipped = 0;
let postgresProfilesNotFound = 0;
let postgresProfilesSkippedTestUser = 0;
let postgresProfilesForceUpdated = 0;
let postgresProfilesFailed = 0;
let postgresProfilesUpdated = 0;


/*
   Helper to test if a paymentMethod is invalid.
   It's invalid by either:
    - not existing
    - missing the basic property `type`
    - having the placeholder value combination of: { type: 'unknown', valid: true }
*/
function invalidPaymentMethod(profile) {
  return (!profile.paymentMethod ||
          !profile.paymentMethod.type ||
          (profile.paymentMethod.type === 'unknown' &&
           profile.paymentMethod.valid));
}

// Helper function to perform the update on the database
function updateProfilePaymentMethod(profile, paymentMethod, dryRun) {
  // Pretend to update the databse if --dry-run is specified
  if (dryRun) {
    console.log(green('UPDATED (dry run)'));
    postgresProfilesUpdated += 1;
    return Promise.resolve();
  }

  // Otherwise, do a real update
  return models.Profile
    .query()
    .patch({ paymentMethod })
    .where('identityId', '=', profile.identityId)
    .then(() => {
      console.log(green('UPDATED'));
      postgresProfilesUpdated += 1;
    });
}


// Helper to process an individual Profile, updating `paymentMethod` if necessary
function processProfile(profile) {
  console.log('\n----------------------------------------------------------------------------');
  console.log('Profile: ', cyan(profile.identityId));
  postgresProfilesTotal += 1;

  // Warn about obvious test Profiles
  if (profile.identityId.indexOf('cafe-cafe') !== -1 ||
      profile.identityId.indexOf('dead-dead') !== -1) {

    console.log(yellow('WARNING Possible test profile'));

    if (script.skipTestUsers) {
      console.log(green('SKIPPED (test user)'));
      postgresProfilesSkippedTestUser += 1;
      postgresProfilesSkipped += 1;
      return Promise.resolve();
    }
  }

  // Check if paymentMethod is already valid
  if (!invalidPaymentMethod(profile)) {
    console.log('Profile.paymentMethod ', green('VALID'));
    console.log(profile.paymentMethod);
    console.log(green('SKIPPED'));
    postgresProfilesSkipped += 1;
    return Promise.resolve();
  }

  // paymentMethod invalid, so proceed
  console.log('Profile.paymentMethod ', red('INVALID'));
  console.log(profile.paymentMethod);
  console.log('Updating...');

  // Fetch the customer information
  const payload = {
    customerId: profile.identityId,
    userId: profile.identityId,
  };
  return bus.call(CUSTOMER_RETRIEVE, payload)
    .then(customer => {
      // Extract the customer paymentMethod or use the default one
      // which indicates that no payment method is available
      const paymentMethod = customer.paymentMethod ? customer.paymentMethod : MISSING_PAYMENT_METHOD;
      console.log('Customer paymentMethod: ', customer.paymentMethod);
      console.log('Updating Profile to: ', paymentMethod);

      // Update the database
      return updateProfilePaymentMethod(profile, paymentMethod, script.dryRun);
    })
    .catch(err => {
      if (err.message.indexOf('404') === -1) {
        console.log('Unexpected error:', profile.identityId, err.message);
        console.log(red('FAILED'));
        postgresProfilesFailed += 1;
      } else {
        postgresProfilesNotFound += 1;

        // Check if we should force-update this to a missing paymentMethod
        if (script.force404) {
          postgresProfilesForceUpdated += 1;

          return updateProfilePaymentMethod(profile, MISSING_PAYMENT_METHOD, script.dryRun);
        }

        // Otherwise, just skip this
        console.log(yellow('SKIPPED (404)'));
        postgresProfilesSkipped += 1;
      }
    });
}


// ----------------------------------------------------------------------------
// Intitialize the database
models.Database.init()
  // Fetch all Profiles in the database
  .then(() => models.Profile.query())
  .then(profiles => {
    // Call `processProfile` for each Profile sequentially
    return Promise.each(profiles, processProfile);
  })
  .then(() => {
    // Print out summary of activity
    console.log('\n\n');
    console.log('Postgres profiles ', cyan('TOTAL'), '\t', postgresProfilesTotal);
    console.log('Postgres profiles  test\t\t', postgresProfilesSkippedTestUser);
    console.log('Postgres profiles  404\t\t', postgresProfilesNotFound);
    console.log('Postgres profiles  forced\t', postgresProfilesForceUpdated);
    console.log('Postgres profiles ', yellow('SKIPPED'), '\t', postgresProfilesSkipped);
    console.log('Postgres profiles ', red('FAILED'), '\t', postgresProfilesFailed);
    console.log('Postgres profiles ',  green('UPDATED'), '\t', postgresProfilesUpdated);
  })
  .finally(() => models.Database.cleanup());

