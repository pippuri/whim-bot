'use strict';

const contactSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/contact.json');
const request = require('request-promise-lite');
const subscriptionOptions = require('./subscriptionOptions.json');
const subscriptionSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscription.json');
const utils = require('../utils');
const validator = require('../validator');
const newSubscriptionSchema = subscriptionSchema.definitions.newSubscription;

const updateSubscriptionSchema = subscriptionSchema.definitions.subscriptionUpdate;
const identitySchema = contactSchema.definitions.identityId;

const newContactSchema = contactSchema.definitions.newContact;
const updateContactSchema = contactSchema.definitions.contactUpdate;

// Configure Chargebee API keys
if (!process.env.CHARGEBEE_SITE || !process.env.CHARGEBEE_API_KEY) {
  throw new Error('Chargebee environment not set up');
}
const API_URL = `https://${process.env.CHARGEBEE_SITE}.chargebee.com/api/v2`;
const REQUEST_AUTH = { user: process.env.CHARGEBEE_API_KEY, pass: '' };

/**
 * An encapsulation of Subscription (manager) that can be used to carrying out
 * new subscription creation, updating etc.
 *
 * Note that the current backing storage in this case is Chargebee, not
 * Postgres. The intention is that this interface stays, but we may use
 * something else as a backing storage when needed.
 */
class SubscriptionManager {

  /**
   * Updates a new customer (customer id + card info + billing address).
   *
   * @param {object} customer - the contact to create the subscription for
   * @return {Promise<object|Error>} The full, created customer data
   */
  static createCustomer(customer) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      customer = validator.validateSync(newContactSchema, customer);
    } catch (error) {
      return Promise.reject(error);
    }

    // Make the Chargebee call with the equivalent data
    const payload = {
      id: customer.identityId,
      billing_address: SubscriptionManager.toChargebeeAddress(customer),
      payment_method: !customer.paymentMethod ? undefined : {
        type: 'card', // We currently only support Stripe with credit card
        gateway: 'stripe',
        reference_id: customer.paymentMethod.token,
      },
    };
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    const url = `${API_URL}/customers`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        const json = JSON.parse(response.toString());
        SubscriptionManager.fromChargebeeAddress(json.customer.billing_address, customer.identityId, json.customer.payment_method);
      });
  }

  /**
   * Updates an existing customer (customer id + card info + billing address).
   *
   * @param {object} customer - the customer contact to update
   * @return {Promise<object|Error>} The full, updated customer data
   */
  static updateCustomer(customer) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      customer = validator.validateSync(updateContactSchema, customer);
    } catch (error) {
      return Promise.reject(error);
    }

    // Make the Chargebee call with the equivalent data
    const payload = {
      id: customer.identityId,
      billing_address: SubscriptionManager.toChargebeeAddress(customer),
      payment_method: !customer.paymentMethod ? undefined : {
        type: 'card', // We currently only support Stripe with credit card
        gateway: 'stripe',
        reference_id: customer.paymentMethod.token,
      },
    };
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    const url = `${API_URL}/customers/${customer.identityId}`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        const json = JSON.parse(response.toString());
        SubscriptionManager.fromChargebeeAddress(json.customer.billing_address, customer.identityId, json.customer.payment_method);
      });
  }

  /**
   * Retrieves an existing customer
   *
   * @param {object} customerId - the customer identityId to retrieve
   * @return {Promise<boolean>} - true if deletion succeeded, false otherwise.
   */
  static deleteCustomer(customerId) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      customerId = validator.validateSync(identitySchema, customerId);
    } catch (error) {
      return Promise.reject(error);
    }

    // Make the Chargebee call with the equivalent data
    const payload = {};
    const url = `${API_URL}/customers/${customerId}/delete`;
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        console.log(JSON.stringify(response.toString()));
      });
  }

  /**
   * Deletes an existing customer with all the stored payment method info etc.
   *
   * @param {object} customerId - the customer identityId to retrieve
   * @return {Promise<object|Error>} The full, deleted customer data
   */
  static retrieveCustomer(customerId) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      customerId = validator.validateSync(identitySchema, customerId);
    } catch (error) {
      return Promise.reject(error);
    }

    // Make the Chargebee call with the equivalent data
    const payload = {};
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    const url = `${API_URL}/customers/${customerId}`;
    return request.get(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        const json = JSON.parse(response.toString());
        SubscriptionManager.fromChargebeeAddress(json.customer.billing_address, customerId, json.customer.payment_method);
      });
  }

  /**
   * Updates an existing user (subscription id + shipping address).
   *
   * @param {object} user - the user contact to update
   * @return {Promise<object|Error>} The customer data, as reported through Chargebee
   */
  static updateUser(user) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      user = validator.validateSync(updateContactSchema, user);
    } catch (error) {
      return Promise.reject(error);
    }

    // Make the Chargebee call with the equivalent data
    const payload = {
      shipping_address: SubscriptionManager.toChargebeeAddress(user),
    };
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    const url = `${API_URL}/subscriptions/${user.identityId}`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        const json = JSON.parse(response.toString());
        SubscriptionManager.fromChargebeeAddress(json.subscription.shipping_address);
      });
  }

  /**
   * Creates a new subscription (plans, addons and associated coupons)
   *
   * Note: This method creates a subscription for an existing customer.
   *
   * @param {object} subscription - the subscription data to use as the basis
   * @param {string} customerId - the customer to create the subscription for
   * @param {string} [userId] - the identity of the user of subscription (optional)
   * @return {Promise<object|ValidationError>} The new subscription data
   */
  static createSubscription(subscription, customerId, userId) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      subscription = validator.validateSync(newSubscriptionSchema, subscription);
      customerId = validator.validateSync(identitySchema, customerId);
      userId = validator.validateSync(identitySchema,
        (typeof userId !== undefined) ? userId : customerId);
    } catch (error) {
      return Promise.reject(error);
    }

    // Make the Chargebee call with the equivalent data
    const payload = SubscriptionManager.toChargebeeSubscription(subscription, customerId, userId);
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    const url = `${API_URL}/customers/${customerId}/subscriptions`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeJSON(json);
      });
  }

  /**
   * Updates an existing subscription and commits it to Chargebee.
   * By default, the old plan, add-ons etc. will be replaced with the new ones.
   * Note that every transaction we do is currently prorated.
   *
   * @param {object} subscription - the subscription changes
   * @param {string} customerId - the customer that orders the subscription
   * @param {string} [userId=customerId] - the user that uses the subscription
   * @param {boolean} [immediate=true] - whether to update immediately
   * @param {boolean} [replace=true] - whether to do a full replacement, or add
   * @return {Promise<object|ValidationError>} The new subscription data
   */
  static updateSubscription(subscription, customerId, userId, immediate, replace) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      subscription = validator.validateSync(updateSubscriptionSchema, subscription);
      customerId = validator.validateSync(identitySchema, customerId);
      userId = validator.validateSync(identitySchema,
        (typeof userId !== undefined) ? userId : customerId);
    } catch (error) {
      return Promise.reject(error);
    }

    // Defaults
    immediate = (typeof immediate === 'boolean') ? immediate : true;
    replace = (typeof replace === 'boolean') ? replace : true;

    // Make the Chargebee call with the equivalent data
    const annotations = {
      end_of_term: !immediate,
      replace_addon_list: replace,
      replace_coupon_list: replace,
    };
    const converted = SubscriptionManager.toChargebeeSubscription(subscription, customerId, userId);
    const payload = Object.assign({}, converted, annotations);
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    const url = `${API_URL}/subscriptions/${userId}`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeJSON(json);
      });
  }

  /**
   * Estimates subscription price (to be able to show it to the user).
   * This estimates the costs of the new additions, given as the subscription
   * object.
   *
   * Note that we are doing the userId->subscription id conversion here to
   * have a basis for the estimates.
   *
   * @param {object} subscription - the subscription changes
   * @param {string} customerId - the customer that orders the subscription
   * @param {string} [userId=customerId] - the user that uses the subscription
   * @param {boolean} [immediate=false] - compute estimate for immediate prorated upgrade
   * @param {boolean} [replace=true] - whether to do a full replacement, or add to the existing subscription
   * @return {object} itemized subscription costs
   */
  static estimateSubscriptionUpdate(subscription, customerId, userId, immediate, replace) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      subscription = validator.validateSync(subscriptionSchema, subscription);
      customerId = validator.validateSync(identitySchema, customerId);
      userId = validator.validateSync(identitySchema,
        (typeof userId !== undefined) ? userId : customerId);

    } catch (error) {
      return Promise.reject(error);
    }

    // Defaults
    immediate = (typeof immediate === 'boolean') ? immediate : true;
    replace = (typeof replace === 'boolean') ? replace : true;

    // Make the Chargebee call with the equivalent data
    const annotations = {
      id: userId,
      replace_addon_list: replace,
      replace_coupon_list: replace,
    };
    const subs = SubscriptionManager.toChargebeeEstimate(subscription, customerId);
    const payload = Object.assign(
      {},
      subs,
      annotations
    );
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    const url = `${API_URL}/estimates/update_subscription`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        const json = JSON.parse(response.toString());
        // Chargebee reports estimate in different fields based on how it got
        // called.
        const estimate = (immediate) ? json.estimate.invoice_estimate : json.estimate.next_invoice_estimate;
        return SubscriptionManager.fromChargebeeEstimate(estimate);
      });
  }

  /**
   * Estimates subscription price (to be able to show it to the user).
   * This estimates the costs of the new additions, given as the subscription
   * object.
   *
   * Note that we are doing the userId->subscription id conversion here to
   * have a basis for the estimates.
   *
   * @param {object} subscription - the subscription changes
   * @param {object} customer - the customer you are estimating the price for
   * @return {object} itemized subscription costs
   */
  static estimateNewSubscription(subscription, customer, immediate, replace) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      subscription = validator.validateSync(subscriptionSchema, subscription);
      customer = validator.validateSync(contactSchema, customer);
    } catch (error) {
      return Promise.reject(error);
    }

    // Estimate subscription - remove ids to prevent duplicate clash
    const subs = SubscriptionManager.toChargebeeEstimate(subscription, customer.identityId);
    delete subs.subscription.id;
    delete subs.customer_id;

    const address = SubscriptionManager.toChargebeeAddress(customer);
    const payload = Object.assign(
      {},
      subs,
      { billing_address: address }
    );
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    const url = `${API_URL}/estimates/create_subscription`;

    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .then(response => {
        const json = JSON.parse(response.toString());
        // Chargebee reports estimate in different fields based on how it got
        // called.
        const estimate = json.estimate.invoice_estimate;
        return SubscriptionManager.fromChargebeeEstimate(estimate);
      });
  }

  /**
   * Lists the different subscription options available for a customer
   * Note: This currently uses a hard-coded JSON, appended with Chargebee
   * estimates until we have something better to offer.
   *
   * Note: You do not need to supply a real, existing customer here. We only
   * need customer information to transform that into an address.
   *
   * @param {object} customer - The customer that we offer the subscription for
   */
  static findSubscriptionOptions(customer) {

    // Fetch estimates for each plan and annotate the itemized prices
    const promises = subscriptionOptions.map(option => {
      return SubscriptionManager.estimateNewSubscription(option, customer)
        .then(estimate => {
          const annotated = utils.cloneDeep(option);
          const items = estimate.lineItems;

          // Find the corresponding line items and get their costs
          const planItem = items.find(item => item.id === annotated.plan.id);
          annotated.plan.price = planItem.price;
          annotated.plan.price = (planItem) ? planItem.price : null;
          annotated.addons = annotated.addons.map(addon => {
            const addonItem = items.find(item => item.id === addon.id);
            addon.price = addonItem.price;
          });

          return annotated;
        });
    });
    return Promise.all(promises);
  }

  /**
   * Retrieves an existing subscription for a customer
   *
   * @param {string} userId - the user identity to fetch the subscription for
   * @return {object} a single subscription object
   */
  static retrieveSubscriptionByUserId(userId) {
    const url = `${API_URL}/subscriptions/{userId}`;
    return request.get(url, { auth: REQUEST_AUTH })
      .then(response => {
        const json = JSON.parse(response.toString());
        return json.list.map(SubscriptionManager.fromChargebeeSubscription);
      });
  }

  /**
   * Retrieves all subscriptions of a customer (can have several subscriptions)
   *
   * @param {string} customerId - the customer identity to fetch the subscription for
   * @return {Array<object>} multiple subscriptions, or empty if none found
   */
  static retrieveSubscriptionsByCustomerId(customerId) {
    const url = `${API_URL}/${customerId}/subscriptions/`;
    return request.get(url, { auth: REQUEST_AUTH })
      .then(response => SubscriptionManager.fromChargebeeJSON(response.toString()));
  }

  /**
   * Converts as many attributes as are available to Chargebee specific format.
   * This method picks the customer information from profile, and all
   * the rest from subscription. Note that the userId part is used as Chargebee
   * subscription id to be able to relate the user to the specific subscription.
   *
   * This is an internal method and not intended to be used from outside. Use
   * the given methods, instead.
   *
   * @param {object} subscription - the subscription in our own schema
   * @param {string} customerId - the identityId of the customer
   * @param {string} [userId] - the identityId of the user (defaults to customerId)
   * @return {object} subscription in Chargebee specific format
   */
  static toChargebeeSubscription(subscription, customerId, userId) {
    // Defaults & validation
    if (typeof subscription !== 'object') {
      throw new TypeError(`'subscription' must be an object, got '${subscription}'`);
    }

    if (typeof customerId !== 'string') {
      throw new TypeError(`'customerId' must be an object, got '${customerId}'`);
    }

    if (typeof userId === 'undefined') {
      userId = customerId;
    } else if (typeof userId !== 'string') {
      throw new TypeError(`'userId' must be an object, got '${userId}'`);
    }

    // Initialize a new subscription by our userId
    const response = {
      id: userId,
      customer_id: customerId,
    };

    // Update subscription plans, coupons and addons; we accept a delta,
    // so this can be any combination of them
    if (subscription.plan) {
      response.plan_id = subscription.plan.id;
    }

    if (subscription.coupons) {
      response.coupon_ids = subscription.coupons.map(coupon => coupon.id);
    }

    if (subscription.addons) {
      response.addons = subscription.addons.map(addon => {
        return { id: addon.id, quantity: addon.quantity };
      });
    }

    return response;
  }

  /**
   * Converts as many attributes as are available to Chargebee specific estimate
   * format. Estimate is almost the same as a subscription, but somehow plan id
   * and subscription id are modelled inside 'subscription' object (for no
   * obvious reason).
   *
   * This is an internal method and not intended to be used from outside. Use
   * the given methods, instead.
   *
   * @param {object} subscription - the subscription in our own schema
   * @param {string} customerId - the identityId of the customer
   * @param {string} [userId] - the identityId of the user (defaults to customerId)
   * @return {object} subscription in Chargebee specific format
   */
  static toChargebeeEstimate(subscription, customerId, userId) {
    // Defaults & validation
    if (typeof subscription !== 'object') {
      throw new TypeError(`'subscription' must be an object, got '${subscription}'`);
    }

    if (typeof customerId !== 'string') {
      throw new TypeError(`'customerId' must be an object, got '${customerId}'`);
    }

    if (typeof userId === 'undefined') {
      userId = customerId;
    } else if (typeof userId !== 'string') {
      throw new TypeError(`'userId' must be an object, got '${userId}'`);
    }

    // Initialize a new subscription by our userId
    const response = {
      subscription: { id: userId },
      customer_id: customerId,
    };

    // Update subscription plans, coupons and addons; we accept a delta,
    // so this can be any combination of them
    if (subscription.plan) {
      response.subscription.plan_id = subscription.plan.id;
    }

    if (subscription.coupons) {
      response.coupon_ids = subscription.coupons.map(coupon => coupon.id);
    }

    if (subscription.addons) {
      response.addons = subscription.addons.map(addon => {
        return { id: addon.id, quantity: addon.quantity };
      });
    }

    return response;
  }

  /**
   * Converts a user Profile to Chargebee compatible shipping address format
   * Note that we currently do not store user street address in the request,
   * so the profile is at best partial.
   *
   * @param {object} customer - the user/customer in our own customer schema
   * @return {object} Subscription in Chargebee specific format
   */
  static toChargebeeAddress(customer) {
    if (typeof customer !== 'object') {
      throw new TypeError(`'customer' must be an object, got '${customer}'`);
    }

    return {
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      line1: undefined,
      line2: undefined,
      city: customer.city,
      zip: customer.zipCode,
      state: undefined,
      state_code: undefined,
      country: customer.countryCode,
    };
  }

  /**
   * Parses a customer object from a Chargebee address (billing or shipping).
   *
   * @param {object} address - Chargebee address to parse
   * @param {string} identityId - The identity of the customer
   * @param {object} [paymentMethod] - Chargebee payment method information
   * @return {object} customer object that follows MaaS customer schema
   */
  static fromChargebeeAddress(address, identityId, paymentMethod) {
    if (typeof address !== 'object') {
      throw new TypeError(`'address' must be an object, got '${address}'`);
    }

    if (typeof identityId !== 'string') {
      throw new TypeError(`'identityId' must be a string, got '${identityId}'`);
    }

    const response = {
      identityId: identityId,
      firstName: address.first_name,
      lastName: address.last_name,
      email: address.email,
      phone: address.phone,
      city: address.city,
      zipCode: address.zip,
      countryCode: address.country,
    };

    if (typeof paymentMethod === 'object') {
      response.paymentMethod = {
        type: paymentMethod.gateway,
        token: paymentMethod.tmp_token,
        active: paymentMethod.status === 'valid',
      };
    }

    return response;
  }

  /**
   * Parses a subscription object from a Chargebee JSON subscription.
   * This can be used to parse a response from Chargebee subscription calls.
   *
   * Note that you can and should use the subscription id as the user id -
   * that is the convention on how we distinguish the user of the subscription.
   *
   * @param {object} subscription - Chargebee subscription to parse
   * @return {object} subscription object that follows our subscription schema
   */
  static fromChargebeeSubscription(subscription) {
    const response = {
      id: subscription.id,
      customerId: subscription.customer_id,
      plan: !subscription.plan_id ? undefined : { id: subscription.plan_id },
      addons: !subscription.addons ? undefined : subscription.addons.map(addon => {
        return {
          id: addon.id,
          quantity: addon.quantity,
        };
      }),
      coupons: !subscription.coupons ? undefined : subscription.coupons.map(coupon => {
        return { id: coupon.coupon_id };
      }),
    };

    if (subscription.plan_id) {
      response.plan = { id: subscription.plan_id };
    }

    return response;
  }

  /**
   * Converts a Chargebee pricing estimate to our pricing format
   * Note: the 'estimate' equals Chargebee next_invoicing_estimate or
   * invoicing_estimate (Chargebee reports these in different columns) based
   * on how it got called.
   *
   * @param {object} estimate - The Chargebee specific invoicing estimate
   * @return {object} the estimate in our format
   */
  static fromChargebeeEstimate(estimate) {
    const pricing = {
    };

    const invoice = estimate;
    const lineItems = invoice.line_items ? invoice.line_items : [];
    const discounts = invoice.discounts ? invoice.discounts : [];
    const currency = invoice.currency_code;

    pricing.lineItems = lineItems.map(item => {
      return {
        id: item.entity_id,
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unitPrice: {
          amount: utils.toFixed(0.01 * item.unit_amount, 2),
          currency: currency,
        },
      };
    });

    pricing.discounts = discounts.map(discount => {
      return {
        description: discount.description,
        discount: {
          amount: utils.toFixed(0.01 * discount.amount, 2),
          currency: currency,
        },
      };
    });

    pricing.total = {
      amount: utils.toFixed(0.01 * estimate.total, 2),
      unit: currency,
    };

    return pricing;
  }

  /**
   * Encodes (& flattens) an object into a Chargebee style format, e.g.
   * arrays get prefixed with 1-base index and nested objects get exploded.
   *
   * Note that this method calls itself recursively.
   *
   * Input: {
   *   subscription: {
   *     addons: [{ id: 'foo' }]
   *   }
   * }
   * Output: {
   *   subscription[addons][1][id]: 'foo'
   * }
   *
   * @param {object} value - The object to encode as Chargebee form
   * @return {object} Chargebee compatible key-value pairs
   */
  static encodeToChargebeeFormat(value) {
    const transformed = {};

    // Helper function that walks through the nested object
    function transform(prefix, value, suffix) {
      // Handle the simple values (non-objects)
      if (typeof value !== 'object' || value === null) {
        transformed[prefix] = value;
        return;
      }

      // Encode array values with 1-based index number
      if (Array.isArray(value)) {
        value.forEach((nested, index) => {
          const transformedKey = (prefix === null) ? '' : `${prefix}`;
          transform(transformedKey, nested, `[${index + 1}]`);
        });
        return;
      }

      // Encode objects by their key
      for (let nestedKey in value) { // eslint-disable-line prefer-const
        if (!value.hasOwnProperty(nestedKey)) {
          continue;
        }

        const nested = value[nestedKey];
        const transformedKey = (prefix === null) ? `${nestedKey}` : `${prefix}[${nestedKey}]${suffix}`;
        transform(transformedKey, nested, '');
      }
    }

    transform(null, value);
    return transformed;
  }
}

module.exports = SubscriptionManager;
