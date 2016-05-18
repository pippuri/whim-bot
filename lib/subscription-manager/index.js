var request = require('request-promise-lite');
var PRODUCTS_ENDPOINT = 'plans';
var ADDONS_ENDPOINT = 'addons';
var CUSTOMERS_ENDPOINT = 'customers';
var SUBSCRIPTIONS_ENDPOINT = 'subscriptions';
var BILLING_INFO_ENDPOINT = 'update_billing_info';
var CARD_ENDPOINT = 'credit_card';

var AUTH_HEADERS =  {
  Authorization: 'Basic ' + new Buffer(process.env.CHARGEBEE_API_KEY).toString('base64'),
};

// Get products
function getStoreProducts() {
  return request.get(process.env.CHARGEBEE_BASE_URL + PRODUCTS_ENDPOINT, {
    json: true,
    headers: AUTH_HEADERS,
  });
}

// get available components
function getStoreComponents() {
  return request.get(process.env.CHARGEBEE_BASE_URL + ADDONS_ENDPOINT, {
    json: true,
    headers: {
      Authorization: 'Basic ' + new Buffer(process.env.CHARGEBEE_API_KEY).toString('base64'),
    },
  });
}

// Get User
function findUser(userId) {
  return request.get(process.env.CHARGEBEE_BASE_URL + CUSTOMERS_ENDPOINT + '/' + userId, {
    json: true,
    headers: AUTH_HEADERS,
  });
}

// Get User subscription (NOTE: userId === subscriptionId)
// if this is not true, search with URL encoded parameter customer_id[in]=userId
function getUserSubscription(userId) {
  return request.get(process.env.CHARGEBEE_BASE_URL + SUBSCRIPTIONS_ENDPOINT + '/' + userId, {
    json: true,
    headers: AUTH_HEADERS,
  });
}

// Create User
function createUser(userId, userInfo) {
  if (!userInfo) throw new Error('no user info');

  // these are ChargeBee types
  if (!userInfo.first_name) throw new Error('no user first_name');
  if (!userInfo.last_name) throw new Error('no user last_name');
  if (!userInfo.email) throw new Error('no user email');
  if (!userInfo.phone) throw new Error('no user phone');
  if (!userInfo.hasOwnProperty('billing_address[country]')) throw new Error('no user country');
  if (!userInfo.hasOwnProperty('billing_address[zip]')) throw new Error('no user ZIP code');
  return request.post(process.env.CHARGEBEE_BASE_URL + CUSTOMERS_ENDPOINT + '/' + userId, {
    json: false,
    headers: AUTH_HEADERS,
    body: userInfo,
  });
}

// Update User billing info
function updateUserBilling(userId, userInfo) {
  if (!userInfo) throw new Error('no user info');

  // these are ChargeBee types
  if (!userInfo.first_name) throw new Error('no user first_name');
  if (!userInfo.last_name) throw new Error('no user last_name');
  if (!userInfo.email) throw new Error('no user email');
  if (!userInfo.hasOwnProperty('billing_address[country]')) throw new Error('no user country');
  if (!userInfo.hasOwnProperty('billing_address[zip]')) throw new Error('no user ZIP code');
  return request.post(process.env.CHARGEBEE_BASE_URL + CUSTOMERS_ENDPOINT + '/' + userId + '/' + BILLING_INFO_ENDPOINT, {
    json: false,
    headers: AUTH_HEADERS,
    body: userInfo,
  });
}

// Update User billing info
function updateUserCreditCard(userId, userInfo) {
  if (!userInfo) throw new Error('no user info');

  // these are ChargeBee types
  userInfo.gateway = 'stripe';
  if (!userInfo.first_name) throw new Error('no user first_name');
  if (!userInfo.last_name) throw new Error('no user last_name');
  if (!userInfo.hasOwnProperty('tmp_token')) throw new Error('no tokenized card info');
  if (!userInfo.hasOwnProperty('billing_country')) throw new Error('no user country code');
  if (!userInfo.hasOwnProperty('billing_zip')) throw new Error('no user ZIP code');
  return request.post(process.env.CHARGEBEE_BASE_URL + CUSTOMERS_ENDPOINT + '/' + userId + '/' + CARD_ENDPOINT, {
    json: false,
    headers: AUTH_HEADERS,
    body: userInfo,
  });
}

module.exports = {
  getUser: function (principalId) {
    return findUser(principalId);
  },

  getUserSubscription: function (principalId) {
    return getUserSubscription(principalId);
  },

  createUser: function (principalId, properties) {
    return createUser(principalId, properties);
  },

  updateUser: function (principalId, properties) {
    return createUser(principalId, properties);
  },

  updateUserBilling: function (principalId, properties) {
    return updateUserBilling(principalId, properties);
  },

  updateUserCreditCard: function (principalId, properties) {
    return updateUserCreditCard(principalId, properties);
  },

  getProducts: function () {
    return getStoreProducts();
  },

  getAddons: function () {
    return getStoreComponents();
  },
};
