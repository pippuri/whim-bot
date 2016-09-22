'use strict';

const Promise = require('bluebird');
const Request = require('request-promise-lite');
const MaaSError = require('../errors/MaaSError');

// configure chargebee secrets
if (!process.env.CHARGEBEE_SITE || !process.env.CHARGEBEE_API_KEY) {
  throw new MaaSError('Chargebee environment not set up', 500);
}
const API_URL = `https://${process.env.CHARGEBEE_SITE}.chargebee.com/api/v2`;
const auth =  { user: process.env.CHARGEBEE_API_KEY, pass: '' };

// Get available plans
function getStorePlans() {
  return Request.get(API_URL + '/plans', { json: true, auth: auth });
}

function getPlanById(planId) {
  return Request.get(`${API_URL}/plans/${planId}`, { json: true, auth: auth });
}

// get available addons
function getStoreAddons() {
  return Request.get(`${API_URL}/addons`, { json: true, auth: auth });
}

function getAddonById(addonId) {
  return Request.get(`${API_URL}/addons/${addonId}`, { json: true, auth: auth });
}

// Get User
function findUser(userId) {
  userId = encodeURIComponent(userId);
  return Request.get(`${API_URL}/customers/${userId}`, { json: true, auth: auth });
}

function getUserSubscription(userId) {
  userId = encodeURIComponent(userId);
  return Request.get(`${API_URL}/subscriptions/${userId}`, { json: true, auth: auth });
}

// Create User
function createUser(userId, planId, userInfo) {
  if (!userInfo) throw new Error('no user info');
  if (!planId) throw new Error('no default plan info');
  if (!userId) throw new Error('no User ID info');
  if (!userInfo.phone) throw new Error('no user phone');
  if (userInfo.hasOwnProperty('billing_country')) {
    userInfo['billing_address[country]'] = userInfo.billing_country;
    delete userInfo.billing_country;
  }
  if (userInfo.hasOwnProperty('billing_zip')) {
    userInfo['billing_address[zip]'] = userInfo.billing_zip;
    delete userInfo.billing_zip;
  }
  if (userInfo.hasOwnProperty('billing_city')) {
    userInfo['billing_address[city]'] = userInfo.billing_city;
    delete userInfo.billing_city;
  }

  // these are ChargeBee types
  userInfo.id = userId;
  userInfo.plan_id = planId;

  return Request.post(`${API_URL}/subscriptions`, { json: false, auth: auth, form: userInfo });
}

// Update User
function updateUser(userId, userInfo) {
  if (!userInfo) throw new Error('no user info');

  // these are ChargeBee types
  if (!userInfo.first_name) throw new Error('no user first_name');
  if (!userInfo.last_name) throw new Error('no user last_name');
  if (!userInfo.email) throw new Error('no user email');
  if (!userInfo.phone) throw new Error('no user phone');
  if (userInfo.hasOwnProperty('billing_country')) {
    userInfo['billing_address[country]'] = userInfo.billing_country;
    delete userInfo.billing_country;
  }
  if (userInfo.hasOwnProperty('billing_zip')) {
    userInfo['billing_address[zip]'] = userInfo.billing_zip;
    delete userInfo.billing_zip;
  }
  if (userInfo.hasOwnProperty('billing_city')) {
    userInfo['billing_address[city]'] = userInfo.billing_city;
    delete userInfo.billing_city;
  }
  if (!userInfo.hasOwnProperty('billing_address[country]')) throw new Error('no user country');
  if (!userInfo.hasOwnProperty('billing_address[zip]')) throw new Error('no user ZIP code');
  if (!userInfo.hasOwnProperty('billing_address[city]')) throw new Error('no user City');

  userId = encodeURIComponent(userId);
  return Request.post(`${API_URL}/customers/${userId}`, { json: false, auth: auth, form: userInfo });
}


// Update User billing info
function updateUserCreditCard(userId, userInfo) {
  if (!userInfo) throw new Error('no user info');

  // these are ChargeBee types
  if (!userInfo.hasOwnProperty('first_name')) throw new Error('no user first_name');
  if (!userInfo.hasOwnProperty('last_name')) throw new Error('no user last_name');
  if (!userInfo.hasOwnProperty('tmp_token') && !userInfo.hasOwnProperty('number')) throw new Error('no tokenized card info');
  if (!userInfo.hasOwnProperty('billing_zip')) throw new Error('no user ZIP code');
  if (!userInfo.hasOwnProperty('billing_city')) throw new Error('no user city');

  userInfo.gateway = 'stripe';
  userInfo.id = userId;

  userId = encodeURIComponent(userId);
  return Request.post(`${API_URL}/customers/${userId}/credit_card`, { json: true, auth: auth, form: userInfo });
}

// Update Subscription Plan
function updatePlan(subId, updatedPlan) {
  if (!subId) throw new Error('no user info');

  const postSubId = encodeURIComponent(subId);
  return Request.post(`${API_URL}/subscriptions/${postSubId}`, { json: false, auth: auth, form: { plan_id: updatedPlan } });
}

// Make a one-time charge on the account
function makePurchase(userId, productId, amount) {
  if (!userId) throw new Error('no user info');

  return Request.post(`${API_URL}/invoices`, { json: true, auth: auth, form: { customer_id: userId, 'addons[id][1]': productId, 'addons[quantity][1]': amount } });
}

function convertToChargebee(properties) {
  const ret = {};
  if (properties.identityId) ret.id = properties.identityId;
  if (properties.email) ret.email = properties.email;
  if (properties.phone) {
    ret.phone = properties.phone;
    ret['shipping_address[phone]'] = ret.phone;
    ret['billing_address[phone]'] = ret.phone;
  }
  if (properties.hasOwnProperty('firstName')) ret.first_name = properties.firstName;
  if (properties.hasOwnProperty('lastName')) ret.last_name = properties.lastName;
  if (properties.hasOwnProperty('street')) ret.billing_addr1 = properties.street;
  if (properties.hasOwnProperty('city')) ret.billing_city = properties.city;
  if (properties.hasOwnProperty('zip')) ret.billing_zip = properties.zip;
  if (properties.hasOwnProperty('country')) ret.billing_country = properties.country;
  if (properties.hasOwnProperty('token')) ret.tmp_token = properties.token;
  if (properties.hasOwnProperty('card')) {
    ret.number = properties.card.number;
    ret.cvv = properties.card.cvv;
    ret.expiry_month = properties.card.expiryMonth;
    ret.expiry_year = properties.card.expiryYear;
  }
  return ret;
}

function formatUser(user) {
  function formatCard(user) {
    if (!user.card) return {};
    return {
      gateway: user.card.gateway,
      last4: user.card.last4,
      type: user.card.card_type,
      expiryMonth: user.card.expiry_month,
      expiryYear: user.card.expiry_year,
      validity: user.card.status,
    };
  }

  function formatBilling(user) {
    if (!user.customer || !user.customer.billing_address) return {};
    return {
      street: user.customer.billing_address.line1,
      country: user.customer.billing_address.country,
      zip: user.customer.billing_address.zip,
      city: user.customer.billing_address.city,
    };
  }
  function formatPlan(user) {
    if (!user.subscription || !user.subscription.plan_id) return {};
    return {
      id: user.subscription.plan_id,
      status: user.subscription.status,
      startDate: user.subscription.current_term_start,
      endDate: user.subscription.current_term_end,
    };
  }
  function parseCustomer(user) {
    if (!user.customer) return {};
    return {
      identityId: user.customer.id,
      firstName: user.customer.first_name,
      lastName: user.customer.last_name,
      email: user.customer.email,
      phone: user.customer.phone,
    };
  }

  if (!user) {
    throw new Error('User info not found');
  }

  const cust = parseCustomer(user);

  return {
    identityId: cust.identityId,
    firstName: cust.firstName,
    lastName: cust.lastName,
    email: cust.email,
    phone: cust.phone,
    address: formatBilling(user),
    card: formatCard(user),
    plan: formatPlan(user),
  };
}

module.exports = {
  getUser: function (identityId) {
    return findUser(identityId).then(user => formatUser(user));
  },

  formatUser: formatUser,

  getUserSubscription: function (identityId) {
    return getUserSubscription(identityId).then( sub => {
      //console.info(sub);
      const ret = formatUser(sub);
      if (sub.subscription) {
        ret.planId = sub.subscription.plan_id;
        ret.currentTerm = {
          startDate: sub.subscription.current_term_start,
          endDate: sub.subscription.current_term_end,
        };
        ret.currency = sub.subscription.currency_code;
        ret.status = sub.subscription.status;
      }

      return ret;
    });
  },

  createUser: function (identityId, defaultPlanId, properties) {
    properties.identityId = identityId;
    return createUser(identityId, defaultPlanId, convertToChargebee(properties)).then(user => formatUser(user));
  },

  updatePlan: function (subscriptionId, planId) {
    return getUserSubscription(subscriptionId).then( user => {
      // happy case where we had a subscription
      if (!user.card) {
        return Promise.reject( new Error('user did not have a payment method on file'));
      }
      if (user.subscription) {
        return updatePlan(subscriptionId, planId);
      }
      return Promise.reject( new Error('user did not have a subscription for some reason'));
    });
  },

  makePurchase: function (identityId, productId, amount) {
    return getUserSubscription(identityId).then( user => {
      // happy case where we had a subscription
      if (!user.card) {
        // can't post a charge as no payment method on file
        return Promise.reject( new Error('user did not have a payment method on file'));
      }
      if (user.subscription) {
        return makePurchase(identityId, productId, amount);
      }
      return Promise.reject( new Error('user did not have a plan selected for some reason'));
    })
    .then( response => {
      return Promise.resolve({
        identityId: response.invoice.customer_id,
        status: response.invoice.status,
        amount: response.invoice.total,
        tax: response.invoice.tax,
      });
    });
  },

  updateUser: function (identityId, properties) {
    return updateUser(identityId, convertToChargebee(properties)).then(user => formatUser(user));
  },

  updateUserCreditCard: function (identityId, properties) {
    return updateUserCreditCard(identityId, convertToChargebee(properties)).then(user => formatUser(user));
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
