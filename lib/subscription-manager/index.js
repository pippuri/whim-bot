var Promise = require('bluebird');
var chargebee = require('chargebee');

// configure chargebee secrets
if (!process.env.CHARGEBEE_SITE || !process.env.CHARGEBEE_API_KEY) {
  throw new Error('Chargebee environment not set up!');
}

chargebee.configure({ site: process.env.CHARGEBEE_SITE, api_key: process.env.CHARGEBEE_API_KEY });

// Get available plans
function getStorePlans() {
  return new Promise((resolve, reject) => {
    chargebee.plan.list({ 'status[is]': 'active' })
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {

          //var customer = result.customer;
          //var card = result.card;
          resolve(result);
        }
      });
  });
}

function getPlanById(planId) {
  return new Promise((resolve, reject) => {
    chargebee.plan.retrieve(planId)
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
  });
}

// get available addons
function getStoreAddons() {
  return new Promise((resolve, reject) => {

    // list only addons whose ID starts with 'points-purchase'
    chargebee.addon.list({ 'status[is]': 'active', 'id[starts_with]': 'points-purchase' })
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
  });
}

function getAddonById(addonId) {
  return new Promise((resolve, reject) => {
    chargebee.addon.retrieve(addonId)
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
  });
}

// Get User
function findUser(userId) {
  return new Promise((resolve, reject) => {
    chargebee.customer.retrieve(userId)
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
  });
}

// Get User subscription (NOTE: userId === subscriptionId)
// if this is not true, search with URL encoded parameter customer_id[in]=userId
function getUserSubscription(userId) {
  return new Promise((resolve, reject) => {
    chargebee.subscription.retrieve(userId)
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
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

  userInfo.id = userId;

  return new Promise((resolve, reject) => {
    chargebee.customer.create(userInfo)
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
  });
}

// Update User
function updateUser(userId, userInfo) {
  if (!userInfo) throw new Error('no user info');

  // these are ChargeBee types
  if (!userInfo.first_name) throw new Error('no user first_name');
  if (!userInfo.last_name) throw new Error('no user last_name');
  if (!userInfo.email) throw new Error('no user email');
  if (!userInfo.phone) throw new Error('no user phone');
  if (!userInfo.hasOwnProperty('billing_address[country]')) throw new Error('no user country');
  if (!userInfo.hasOwnProperty('billing_address[zip]')) throw new Error('no user ZIP code');

  return new Promise((resolve, reject) => {
    chargebee.customer.update(userId, userInfo)
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
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
  return new Promise((resolve, reject) => {
    chargebee.customer.update_billing_info(userId, userInfo)
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
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
  return new Promise((resolve, reject) => {
    chargebee.card.update_card_for_customer(userId, userInfo)
      .request((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
  });
}

module.exports = {
  getUser: function (identityId) {
    return findUser(identityId);
  },

  getUserSubscription: function (identityId) {
    return getUserSubscription(identityId);
  },

  createUser: function (identityId, properties) {
    return createUser(identityId, properties);
  },

  updateUser: function (identityId, properties) {
    return updateUser(identityId, properties);
  },

  updateUserBilling: function (identityId, properties) {
    return updateUserBilling(identityId, properties);
  },

  updateUserCreditCard: function (identityId, properties) {
    return updateUserCreditCard(identityId, properties);
  },

  getProducts: function () {
    return Promise.all([getStorePlans(), getStoreAddons()]);
  },

  getPlans: function () {
    return getStorePlans();
  },

  getPlanById: function (planId) {
    return getPlanById(planId);
  },

  getAddons: function () {
    return getStoreAddons();
  },

  getAddonById: function (addonId) {
    return getAddonById(addonId);
  },
};
