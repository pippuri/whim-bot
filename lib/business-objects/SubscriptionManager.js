'use strict';

const addressSchema = require('maas-schemas/prebuilt/core/address.json');
const contactSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/contact.json');
const MaaSError = require('../errors/MaaSError');
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

  static get DEFAULT_SUBSCRIPTION() {
    return { plan: { id: 'fi-whim-payg' } };
  }

  static get TOPUP_ID() {
    return 'fi-whim-topup';
  }

  /**
   * Updates a new customer (customer id + card info + billing address).
   *
   * @param {object} customer - the contact to create the subscription for
   * @return {Promise<object|Error>} The full, created customer data
   */
  static createCustomer(customer) {

    let form;
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      customer = validator.validateSync(newContactSchema, customer);

      const payload = {
        id: customer.identityId,
        billing_address: SubscriptionManager.toChargebeeAddress(customer),
      };

      if (customer.paymentMethod) {
        payload.card = SubscriptionManager.toChargebeeCard(customer);
      }
      form = SubscriptionManager.encodeToChargebeeFormat(payload);
    } catch (error) {
      Promise.reject(error);
    }

    const url = `${API_URL}/customers`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeAddress(
          json.customer.billing_address,
          customer.identityId,
          json.customer.payment_method
        );
      });
  }

  /**
   * Retrieves an existing customer
   *
   * @param {object} customerId - the customer identityId to retrieve
   * @return {Promise<object|Error>} The full, deleted customer data
   */
  static retrieveCustomer(customerId) {

    let form;
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      customerId = validator.validateSync(identitySchema, customerId);

      const payload = {};
      form = SubscriptionManager.encodeToChargebeeFormat(payload);
    } catch (error) {
      return Promise.reject(error);
    }

    const url = `${API_URL}/customers/${customerId}`;
    return request.get(url, { auth: REQUEST_AUTH, form: form })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeAddress(
          json.customer.billing_address,
          customerId,
          json.customer.payment_method
        );
      });
  }

  /**
   * Updates an existing customer (customer id + card info + billing address).
   *
   * @param {object} customer - the customer contact to update
   * @return {Promise<object|Error>} The full, updated customer data
   */
  static updateCustomer(customer) {

    const promises = [];
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      customer = validator.validateSync(updateContactSchema, customer);

      // When updating user, billing address, payment method and card update
      // all need to be updated through different endpoints. When specifying a
      // credit card, we need to update all of them.

      // Billing address change
      const billingForm = SubscriptionManager.encodeToChargebeeFormat({
        billing_address: SubscriptionManager.toChargebeeAddress(customer),
      });
      promises.push(request.post(
        `${API_URL}/customers/${customer.identityId}/update_billing_info`,
        { auth: REQUEST_AUTH, form: billingForm }
      ));

      // Payment method changes
      if (customer.paymentMethod) {
        const card = SubscriptionManager.toChargebeeCard(customer);
        const cardForm = SubscriptionManager.encodeToChargebeeFormat(card);
        promises.push(request.post(
          `${API_URL}/customers/${customer.identityId}/credit_card`,
          { auth: REQUEST_AUTH, form: cardForm }
        ));
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return Promise.all(promises)
      .catch(SubscriptionManager.parseError)
      .then(responses => responses.map(r => JSON.parse(r.toString())))
      .then(responses => {
        const billingAddress = responses[0].customer.billing_address;
        let paymentMethod;

        if (typeof responses[1] !== 'undefined') {
          paymentMethod = responses[1].customer.payment_method;
        }

        return SubscriptionManager.fromChargebeeAddress(billingAddress, customer.identityId, paymentMethod);
      });
  }

  /**
   * Deletes an existing customer with all the stored payment method info etc.
   *
   * @param {object} customerId - the customer identityId to delete
   * @return {Promise<null|Error>} - the deleted profile
   */
  static deleteCustomer(customerId) {

    try {
      // Perform the validation of the object - let TypeError happen if need be.
      customerId = validator.validateSync(identitySchema, customerId);
    } catch (error) {
      return Promise.reject(error);
    }

    const url = `${API_URL}/customers/${customerId}/delete`;
    return request.post(url, { auth: REQUEST_AUTH, form: {} })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeAddress(
          json.customer.billing_address,
          customerId,
          json.customer.payment_method
        );
      });
  }

  /**
   * Updates an existing user (subscription id + shipping address).
   *
   * @param {object} user - the user contact to update
   * @return {Promise<object|Error>} The customer data, as reported through Chargebee
   */
  static updateUser(user) {

    let form;
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      user = validator.validateSync(updateContactSchema, user);

      const payload = {
        shipping_address: SubscriptionManager.toChargebeeAddress(user),
      };
      form = SubscriptionManager.encodeToChargebeeFormat(payload);
    } catch (error) {
      return Promise.reject(error);
    }

    const url = `${API_URL}/subscriptions/${user.identityId}`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .catch(SubscriptionManager.parseError)
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

    let form;
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      subscription = validator.validateSync(newSubscriptionSchema, subscription);
      customerId = validator.validateSync(identitySchema, customerId);
      userId = validator.validateSync(identitySchema,
        (typeof userId !== 'undefined') ? userId : customerId);

      const payload = SubscriptionManager.toChargebeeSubscription(subscription, customerId, userId);
      form = SubscriptionManager.encodeToChargebeeFormat(payload);
    } catch (error) {
      return Promise.reject(error);
    }

    const url = `${API_URL}/customers/${customerId}/subscriptions`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeSubscription(json.subscription);
      });
  }

  /**
   * Retrieves an existing subscription for a customer
   *
   * @param {string} userId - the user identity to fetch the subscription for
   * @return {object} a single subscription object
   */
  static retrieveSubscriptionByUserId(userId) {
    const url = `${API_URL}/subscriptions/${userId}`;
    return request.get(url, { auth: REQUEST_AUTH })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeSubscription(json.subscription);
      });
  }

  /**
   * Retrieves all subscriptions of a customer (can have several subscriptions)
   *
   * @param {string} customerId - the customer identity to fetch the subscription for
   * @return {Array<object>} multiple subscriptions, or empty if none found
   */
  static retrieveSubscriptionsByCustomerId(customerId) {
    const url = `${API_URL}/subscriptions`;
    const query = { 'customer_id[is]': customerId };
    return request.get(url, { auth: REQUEST_AUTH, qs: query })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        return json.list.map(i => SubscriptionManager.fromChargebeeSubscription(i.subscription));
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
   * @param {boolean} [replace=false] - whether to do a full replacement, or add
   * @return {Promise<object|ValidationError>} The new subscription data
   */
  static updateSubscription(subscription, customerId, userId, immediate, replace) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      subscription = validator.validateSync(updateSubscriptionSchema, subscription);
      customerId = validator.validateSync(identitySchema, customerId);
      userId = validator.validateSync(identitySchema,
        (typeof userId !== 'undefined') ? userId : customerId);
    } catch (error) {
      return Promise.reject(error);
    }

    // Defaults
    immediate = (typeof immediate === 'boolean') ? immediate : true;
    replace = (typeof replace === 'boolean') ? replace : false;

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
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeSubscription(json.subscription);
      });
  }

  /**
   * Deletes a subscription for an user.
   * Note: The nested user information (shipping address) will be deleted, too.
   *
   * @param {object} userId - the user identityId (subscription id) to delete
   * @return {Promise<object>} - containing the deleted user profile
   */
  static deleteSubscription(userId) {
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      userId = validator.validateSync(identitySchema, userId);
    } catch (error) {
      return Promise.reject(error);
    }

    const payload = {};
    const url = `${API_URL}/subscriptions/${userId}/delete`;
    const form = SubscriptionManager.encodeToChargebeeFormat(payload);
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        return SubscriptionManager.fromChargebeeSubscription(json.subscription);
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
   * @param {boolean} [immediate=true] - compute estimate for immediate prorated upgrade
   * @param {boolean} [replace=true] - whether to do a full replacement, or add to the existing subscription
   * @return {object} itemized subscription costs
   */
  static estimateSubscriptionUpdate(subscription, customerId, userId, immediate, replace) {

    let form;
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      subscription = validator.validateSync(subscriptionSchema, subscription);
      customerId = validator.validateSync(identitySchema, customerId);
      userId = validator.validateSync(identitySchema,
        (typeof userId !== 'undefined') ? userId : customerId);

      // Defaults
      immediate = (typeof immediate === 'boolean') ? immediate : true;
      replace = (typeof replace === 'boolean') ? replace : true;

      const annotations = {
        customer_id: customerId,
        replace_addon_list: replace,
        replace_coupon_list: replace,
        end_of_term: !immediate,
      };
      const subs = SubscriptionManager.toChargebeeEstimate(subscription);
      const payload = Object.assign({}, subs, annotations);
      payload.subscription.id = userId;
      form = SubscriptionManager.encodeToChargebeeFormat(payload);
    } catch (error) {
      return Promise.reject(error);
    }

    const url = `${API_URL}/estimates/update_subscription`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        // Chargebee reports estimate in different fields based on how it got
        // called.
        const estimate = (json.estimate.invoice_estimate) ?
          json.estimate.invoice_estimate : json.estimate.next_invoice_estimate;
        return SubscriptionManager.fromChargebeeEstimate(estimate);
      });
  }

  /**
   * Estimates subscription price (to be able to show it to the user).
   * This estimates the costs of a new subscription, using the given country
   * and zip code information to compute the applicable taxes.
   *
   * Note that we are doing the userId->subscription id conversion here to
   * have a basis for the estimates.
   *
   * @param {object} subscription - the subscription changes
   * @param {object} customer - the customer you are estimating the price for
   * @return {object} itemized subscription costs
   */
  static estimateNewSubscription(subscription, countryCode, zipCode) {

    let form;
    try {
      // Perform the validation of the object - let TypeError happen if need be.
      subscription = validator.validateSync(subscriptionSchema, subscription);
      countryCode = validator.validateSync(
        addressSchema.definitions.countryCode, countryCode);
      zipCode = validator.validateSync(
        addressSchema.definitions.zipCode, zipCode);
      subscription = validator.validateSync(subscriptionSchema, subscription);

      // Estimate subscription - remove ids to prevent duplicate clash
      const subs = SubscriptionManager.toChargebeeEstimate(subscription);
      const payload = Object.assign({}, subs,
        {
          'billing_address[zip]': zipCode,
          'billing_address[country]': countryCode,
        }
      );
      form = SubscriptionManager.encodeToChargebeeFormat(payload);
    } catch (error) {
      return Promise.reject(error);
    }

    const url = `${API_URL}/estimates/create_subscription`;
    return request.post(url, { auth: REQUEST_AUTH, form: form })
      .catch(SubscriptionManager.parseError)
      .then(response => {
        const json = JSON.parse(response.toString());
        const estimate = json.estimate.invoice_estimate;
        return SubscriptionManager.fromChargebeeEstimate(estimate);
      });
  }

  /**
   * Lists the different subscription options available in a given location.
   * This filters the plans by subscription options' geolocation, then reverse
   * geocodes the location to obtain country and zip code, and uses these for
   * calculating sales tax.
   *
   * Note: Currently these are hard-coded to Finland / 00100
   *
   * @param {object} location - lat-lon pair of users' home
   */
  static findSubscriptionOptions(location) {
    // TODO Implement lat-lon filtering and geolocation lookup when we expand
    const countryCode = 'FI';
    const zipCode = '00100';

    // Fetch estimates for each plan and annotate the itemized prices
    const promises = subscriptionOptions.map(option => {
      return SubscriptionManager.estimateNewSubscription(option, countryCode, zipCode)
        .then(estimate => {
          const annotated = utils.cloneDeep(option);
          const items = estimate.lineItems;
          const discounts = estimate.discounts;

          // Find the corresponding line items and get their costs
          const planItem = items.find(item => {
            return item.id === annotated.plan.id && item.type === 'plan';
          });

          annotated.plan.price = (planItem) ? planItem.unitPrice : null;
          annotated.addons.forEach(addon => {
            const addonItem = items.find(item => {
              return item.id === addon.id && item.type === 'addon';
            });
            if (addonItem) {
              addon.unitPrice = addonItem.unitPrice;
            } else {
              // FIXME Zero-priced items are not displayed in estimates
              addon.unitPrice = {
                amount: 0,
                currency: annotated.plan.price.currency,
              };
            }
          });

          annotated.discounts = discounts;
          return annotated;
        });
    });
    return Promise.all(promises);
  }

  /**
   * Finds a subsciption option by plan id. This query is primarily intended
   * for internal lookups, and hence does not price the plans.
   *
   * @param {string} planId - the plan that corresponds the subscription
   */
  static findSubscriptionOption(planId) {
    // Fetch estimates for each plan and annotate the itemized prices
    try {
      const option = subscriptionOptions.find(option => option.plan.id === planId);
      return Promise.resolve(option);
    } catch (error) {
      return Promise.reject(error);
    }
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
      throw new TypeError(`'userId' must be a string, got '${userId}'`);
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
   * @return {object} subscription estimate  in Chargebee specific format
   */
  static toChargebeeEstimate(subscription, customerId, userId) {
    // Defaults & validation
    if (typeof subscription !== 'object') {
      throw new TypeError(`'subscription' must be an object, got '${subscription}'`);
    }

    // Initialize a new subscription by our userId
    const response = { subscription: {} };

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
      line1: customer.address,
      line2: undefined,
      city: customer.city,
      zip: customer.zipCode,
      state: undefined,
      state_code: undefined,
      country: customer.countryCode,
    };
  }

  /**
   * Converts a user Profile to Chargebee compatible card method format.
   *
   * @param {object} customer - the user/customer in our own customer schema
   * @return {object} Customer card in Chargebee format
   */
  static toChargebeeCard(customer) {
    if (typeof customer !== 'object') {
      throw new TypeError(`'customer' must be an object, got '${customer}'`);
    }

    ['city', 'countryCode', 'zipCode'].forEach(attribute => {
      const value = customer[attribute];
      if (typeof value !== 'string') {
        throw new TypeError(`'${attribute}' must be a string, got '${value}'`);
      }
    });

    const method = customer.paymentMethod;
    if (typeof customer.paymentMethod !== 'object') {
      const msg = `'customer.paymentMethod' must be an object, got '${method}'`;
      throw new TypeError(msg);
    }

    const response = {
      first_name: customer.firstName,
      last_name: customer.lastName,
      billing_addr1: customer.address,
      billing_city: customer.city,
      billing_zip: customer.zipCode,
      billing_country: customer.countryCode,
    };

    if (method && method.type === 'card') {
      response.gateway = 'chargebee';
      response.number = method.number;
      response.expiry_month = method.expiryMonth;
      response.expiry_year = method.expiryYear;
      response.cvv = method.cvv;
    } else if (method.type === 'stripe') {
      response.gateway = 'stripe';
      response.tmp_token = method.token;
    } else {
      throw new TypeError(`Unknown payment type ${method.type} specified`);
    }

    return response;
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
      if (paymentMethod.gateway === 'stripe') {
        response.paymentMethod = {
          type: 'stripe',
          valid: paymentMethod.status === 'valid',
        };
      } else {
        response.paymentMethod = {
          type: 'card',
          valid: paymentMethod.status === 'valid',
        };
      }
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

    const lineItems = estimate.line_items ? estimate.line_items : [];
    const discounts = estimate.discounts ? estimate.discounts : [];
    const taxes = estimate.taxes ? estimate.taxes : [];
    const currency = estimate.currency_code;

    pricing.lineItems = lineItems.map(item => {
      const quantity = item.quantity;
      const unitTax = item.tax_amount / quantity;
      const unitDiscount = item.discount_amount / quantity;
      const price = item.unit_amount - unitDiscount;
      return {
        id: item.entity_id,
        type: item.entity_type,
        description: item.description,
        quantity: quantity,
        unitPrice: {
          amount: utils.toFixed(0.01 * price, 2),
          taxes: utils.toFixed(0.01 * unitTax, 2),
          currency,
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

    const taxesTotal = taxes.reduce((sum, tax) => sum + tax.amount, 0);
    pricing.total = {
      amount: utils.toFixed(0.01 * estimate.total, 2),
      taxes: utils.toFixed(0.01 * taxesTotal, 2),
      currency: currency,
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
        const transformedKey = (prefix === null) ? '' : `${prefix}${suffix}`;
        transformed[transformedKey] = value;
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

  /**
   * Parses the Chargebee/RPL error and re-throws it as our own error
   *
   * @param {Error} error - The Chargebee or request-promise-lite error
   * @return {Error} error with an user-readable message.
   */
  static parseError(error) {
    // Parse the errors with HTTP semantics
    let message = error.message;
    let code = error.statusCode || 500;

    if (error instanceof request.HTTPError) {
      const response = JSON.parse(error.response.toString());
      console.warn(`Chargebee failed with error ${JSON.stringify(response)}`);

      switch (response.api_error_code) {
        case 'payment_method_not_present':
          message = 'No payment method available to complete the operation';
          break;
        case 'param_wrong_value':
          message = 'Request validation failed - invalid values';
          break;
        case 'payment_method_verification_failed':
          message = 'Payment method validation failed';
          break;
        case 'invalid_state_for_request':
          message = 'Request validation failed - conflicting values';
          code = 400;
          break;
        case 'resource_not_found':
          message = 'Resource not found';
          break;
        case 'invalid_request':
          /* eslint-disable max-depth */
          switch (response.error_code) {
            case 'coupon_not_applicable':
              message = 'Given coupon is not applicable for this request';
              break;
            default:
              message = 'Invalid request';
          }
          break;
        default:
          console.warn(`Unknown Chargebee error: ${JSON.stringify(response)}`);
      }
    } else {
      console.warn(`Unknown Chargebee error: ${error.toString()}`);
    }

    // Don't know what to do - return as-is
    throw new MaaSError(message, code);
  }
}

module.exports = SubscriptionManager;
