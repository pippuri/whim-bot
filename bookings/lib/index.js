'use strict';

const bus = require('../../lib/service-bus');
const maasUtils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const Promise = require('bluebird');
const knexFactory = require('knex');
const Model = require('objection').Model;
const _ = require('lodash');
const tspData = require('../lib/tspData.json');
const MaasError = require('../../lib/errors/MaaSError');

/**
 * Find agency by their id
 * Note: It's easier to have this returning a Promise <-Easier to read->
 */
function findAgency(agencyId) {

  const tspIdList = Object.keys(tspData).map(tspDatum => {
    return tspData[tspDatum].agencyId;
  });

  const tspIdListUpperCase = tspIdList.map(id => {
    return id.toUpperCase();
  });

  if (!_.includes(tspIdListUpperCase, agencyId.toUpperCase())) {
    return Promise.reject(new MaasError(`AgencyId "${agencyId}" not exist`, 500));
  }

  if (!_.includes(tspIdListUpperCase, agencyId.toUpperCase())) {
    return Promise.reject(new MaasError(`Invalid input agencyId, do you mean "${tspIdList[tspIdListUpperCase.indexOf(agencyId.toUpperCase())]}"?`, 400));
  }

  const agencyIdList = Object.keys(tspData).map(key => {
    return tspData[key].agencyId;
  });

  if (_.includes(agencyIdList, agencyId)) {
    return Promise.resolve(tspData[agencyId]);
  }

  return Promise.reject('No suitable TSP found with id ' + agencyId);
}

function initKnex() {
  //console.log('Initialize knex');

  // FIXME Change variable names to something that tells about MaaS in general
  const connection = {
    host: process.env.MAAS_PGHOST,
    user: process.env.MAAS_PGUSER,
    password: process.env.MAAS_PGPASSWORD,
    database: process.env.MAAS_PGDATABASE,
  };
  const config = {
    debug: true,
    client: 'pg',
    acquireConnectionTimeout: 10000,
    connection: connection,
  };

  const knex = knexFactory(config);
  Model.knex(knex);

  return Promise.resolve(knex);
}

function fetchCustomerProfile(identityId) {
  //console.log(`Fetch customer profile ${identityId}`);

  // FIXME The 'Item' envelope is unnecessary in profile
  return bus.call('MaaS-profile-info', {
    identityId: identityId,
  })
  .then(data => {
    // Append identity ID
    return Object.assign({ identityId: identityId }, data.Item);
  });
}

function validateSignatures(input) {
  //console.log(`Validating input signature ${input.signature}`);

  // Verify that the data matches the signature
  const originalSignature = input.signature;
  const withoutSignature = Object.assign({}, input);
  delete withoutSignature.signature;

  const computedSignature = maasUtils.sign(withoutSignature, process.env.MAAS_SIGNING_SECRET);

  if (originalSignature === computedSignature) {
    return Promise.resolve(input);
  }

  console.warn(`Validation failed. Current: ${originalSignature} Expected: ${computedSignature}`);

  // FIXME change routeId term
  return Promise.reject(new MaaSError('Signature validation failed.', 400));
}

function removeSignatures(input) {
  delete input.signature;

  return input;
}

// FIXME change itinerary cost to booking cost
function computeBalance(itinerary, profile) {
  //console.log(`Computing balance for ${profile.identityId}`);

  // Check that the user has sufficient balance
  const cost = itinerary.fare.points;
  const balance = profile.balance;
  const message = `Insufficent balance (required: ${cost}, actual: ${balance})`;

  //console.log(`Balance ${profile.identityId}`);

  if (balance > cost) {
    return balance - cost;
  }

  throw new MaaSError(message, 403);
}

function updateBalance(identityId, newBalance) {
  console.log(`Update new balance ${newBalance}`);

  return bus.call('MaaS-profile-edit', {
    identityId: identityId,
    payload: {
      balance: newBalance,
    },
  });
}

module.exports = {
  findAgency: findAgency,
  initKnex: initKnex,
  fetchCustomerProfile: fetchCustomerProfile,
  validateSignatures: validateSignatures,
  removeSignatures: removeSignatures,
  computeBalance: computeBalance,
  updateBalance: updateBalance,
};
