var Promise = require('bluebird');
var chargebee = require('chargebee');

// configure chargebee secrets
if (!process.env.CHARGEBEE_SITE || !process.env.CHARGEBEE_API_KEY) {
  throw new Error('Chargebee environment not set up!');
}

chargebee.configure({ site: process.env.CHARGEBEE_SITE, api_key: process.env.CHARGEBEE_API_KEY });

// Get products
function getStoreProducts() {
  return new Promise(function (success, error) {
    chargebee.plan.list({ 'status[is]': 'active' })
      .request(function (err, result) {
        if (err) {
          //handle error
          console.log('products failed', err);
          error(err);
        } else {
          //var customer = result.customer;
          //var card = result.card;
          success(result);
        }
      });
  });
}

// get available components
function getStoreComponents() {
  return new Promise(function (success, error) {

    // list only plans whose ID starts with 'points-purchase'
    chargebee.addon.list({ 'status[is]': 'active', 'id[starts_with]': 'points-purchase' })
      .request(function (err, result) {
        if (err) {
          //handle error
          console.log('components failed', err);
          error(err);
        } else {
          success(result);
        }
      });
  });
}

// Get User
function findUser(userId) {
  return new Promise(function (success, error) {
    chargebee.customer.retrieve(userId)
       .request(function (err, result) {
        if (err) {
          //handle error
          console.log('components failed', err);
          error(err);
        } else {
          success(result);
        }
      });
  });
}

// Get User subscription (NOTE: userId === subscriptionId)
// if this is not true, search with URL encoded parameter customer_id[in]=userId
function getUserSubscription(userId) {
  return new Promise(function (success, error) {
    chargebee.subscription.retrieve(userId)
      .request(function (err, result) {
        if (err) {
          //handle error
          console.log('components failed', err);
          error(err);
        } else {
          success(result);
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

  return new Promise(function (success, error) {
    chargebee.customer.create(userInfo)
      .request(function (err, result) {
        if (err) {
          //handle error
          console.log('components failed', err);
          error(err);
        } else {
          success(result);
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

  return new Promise(function (success, error) {
    chargebee.customer.update(userId, userInfo)
      .request(function (err, result) {
        if (err) {
          //handle error
          console.log('components failed', err);
          error(err);
        } else {
          success(result);
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
  return new Promise(function (success, error) {
    chargebee.customer.update_billing_info(userId, userInfo)
      .request(function (err, result) {
        if (err) {
          //handle error
          console.log('components failed', err);
          error(err);
        } else {
          success(result);
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
  return new Promise(function (success, error) {
    chargebee.card.update_card_for_customer(userId, userInfo)
      .request(function (err, result) {
        if (err) {
          //handle error
          console.log('components failed', err);
          error(err);
        } else {
          success(result);
        }
      });
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
    return updateUser(principalId, properties);
  },

  updateUserBilling: function (principalId, properties) {
    return updateUserBilling(principalId, properties);
  },

  updateUserCreditCard: function (principalId, properties) {
    return updateUserCreditCard(principalId, properties);
  },

  getProducts: function () {
    return Promise.all([getStoreProducts(), getStoreComponents()]);
  },

  getAddons: function () {
    return getStoreComponents();
  },
};
