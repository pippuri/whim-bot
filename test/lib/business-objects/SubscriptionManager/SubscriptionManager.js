'use strict';

const contactSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/contact.json');
const expect = require('chai').expect;
const pricingSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/pricing.json');
const SubscriptionManager = require('../../../../lib/business-objects/SubscriptionManager');
const subscriptionSchema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscription.json');

const validator = require('../../../../lib/validator');

const newSubscriptionSchema = subscriptionSchema.definitions.newSubscription;
const fullContactSchema = contactSchema.definitions.fullContact;

const testUserIdentity = 'eu-west-1:00000000-dead-dead-eaea-000000000000';
const customerId = testUserIdentity;
const userId = testUserIdentity;

// MaaS Subscriptions
const newSubscription = require('./maas-subscription-new.json');
const addonSubscription = require('./maas-subscription-addon.json');

// Note: Chargebee subscriptions are not exactly the same with requests
// and responses (request: coupons_ids: <id>, response: coupons: {id: <id>})
const cbnewSubscription = require('./chargebee-subscription-new.json');
const cbAddonSubscription = require('./chargebee-subscription-addon.json');
const cbAddress = require('./chargebee-address.json');
const cbPaymentMethod = require('./chargebee-payment-method');
const cbEstimate = require('./chargebee-estimate.json').estimate.next_invoice_estimate;
const fullContact = require('./maas-contact-full.json');

describe('toChargebeeSubscription', () => {
  it('Converts to a valid Chargebee subscription with full data', () => {
    const cbSubscription = SubscriptionManager.toChargebeeSubscription(newSubscription,
      customerId, userId);

    // Subscription
    expect(cbSubscription.id).to.equal(userId);
    expect(cbSubscription.customer_id).to.equal(customerId);

    expect(cbSubscription.plan_id).to.equal(newSubscription.plan.id);
    expect(cbSubscription.addons[0].id).to.equal(newSubscription.addons[0].id);
    expect(cbSubscription.coupon_ids[0]).to.equal(newSubscription.coupons[0].id);
  });

  it('Converts to a valid Chargebee subscription with just an addon', () => {
    const cbSubscription = SubscriptionManager.toChargebeeSubscription(addonSubscription, userId, customerId);

    expect(cbSubscription.plan_id).to.not.exist;
    expect(cbSubscription.coupon_ids).to.not.exist;
    expect(cbSubscription.addons[0].id).to.equal(addonSubscription.addons[0].id);
  });
});

describe('fromChargebeeSubscription', () => {
  it('Converts to a valid MaaS subscription with full data', () => {
    const maasSubscription = SubscriptionManager.fromChargebeeSubscription(cbnewSubscription);

    expect(validator.validateSync(newSubscriptionSchema, maasSubscription)).to.be.an.object;

    expect(maasSubscription.plan.id).to.equal(cbnewSubscription.plan_id);
    expect(maasSubscription.addons[1].id).to.equal(cbnewSubscription.addons[1].id);
    expect(maasSubscription.coupons[0].id).to.equal(cbnewSubscription.coupons[0].coupon_id);
  });

  it('Converts to a valid MaaS subscription with just an addon', () => {
    const maasSubscription = SubscriptionManager.fromChargebeeSubscription(cbAddonSubscription);

    expect(validator.validateSync(subscriptionSchema, maasSubscription)).to.be.an.object;

    expect(maasSubscription.plan).to.not.exist;
    expect(maasSubscription.addons[0].id).to.equal(cbAddonSubscription.addons[0].id);
    expect(maasSubscription.coupons).to.not.exist;
  });
});

describe('toChargebeeAddress', () => {
  it('Converts to a valid Chargebee address from a contact with full data', () => {
    const cbAddress = SubscriptionManager.toChargebeeAddress(fullContact);

    // Subscription
    expect(cbAddress.first_name).to.equal(fullContact.firstName);
    expect(cbAddress.last_name).to.equal(fullContact.lastName);
    expect(cbAddress.email).to.equal(fullContact.email);
    expect(cbAddress.phone).to.equal(fullContact.phone);
    expect(cbAddress.zip).to.equal(fullContact.zipCode);
    expect(cbAddress.city).to.equal(fullContact.city);
    expect(cbAddress.country).to.equal(fullContact.countryCode);
  });
});

describe('fromChargebeeAddress', () => {
  it('Converts from a Chargebee address to a valid customer & payment method', () => {
    const contact = SubscriptionManager.fromChargebeeAddress(cbAddress, userId, cbPaymentMethod);

    expect(validator.validate(fullContactSchema, contact)).to.be.an.object;

    expect(contact.identityId).to.equal(userId);
    expect(contact.firstName).to.equal(cbAddress.first_name);
    expect(contact.lastName).to.equal(cbAddress.last_name);
    expect(contact.email).to.equal(cbAddress.email);
    expect(contact.phone).to.equal(cbAddress.phone);
    expect(contact.city).to.equal(cbAddress.city);
    expect(contact.zipCode).to.equal(cbAddress.zip);
    expect(contact.countryCode).to.equal(cbAddress.country);
  });
});

describe('fromChargebeeEstimate', () => {
  it('Converts to valid pricing object from a Chargebee estimate', () => {
    const pricing = SubscriptionManager.fromChargebeeEstimate(cbEstimate);
    const lineItemTotal = pricing.lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice.amount, 0);

    expect(validator.validate(pricingSchema, pricing)).to.be.an.object;
    expect(lineItemTotal).to.equal(pricing.total.amount);
  });
});

describe('encodeToChargebeeFormat', () => {
  const original = { subscription: addonSubscription };
  const encoded = SubscriptionManager.encodeToChargebeeFormat(original);

  it('Converts nested objects properly', () => {
    expect(encoded['subscription[addons][id][1]']).to.equal(original.subscription.addons[0].id);
    expect(encoded['subscription[addons][id][1]']).to.equal(original.subscription.addons[0].id);
  });
});
