'use strict';

const bus = require('../../../lib/service-bus/index');
const expect = require('chai').expect;
const LAMBDA = 'MaaS-profile-webhook';

module.exports = function (identityId) {

  describe('profile-webhook-chargebee-subscription-created', () => {
    //[XXX: linting disabled so that we can paste chargebee events in unchanged]
    /* eslint-disable comma-dangle, quote-props, quotes, indent, object-curly-spacing */
    const webhook_content = {
      "subscription": {
        "id": "eu-west-1:00000000-cafe-cafe-cafe-000000000000",
        "plan_id": "fi-whim-payg",
        "plan_quantity": 1,
        "status": "active",
        "current_term_start": 1477041873,
        "current_term_end": 1479720273,
        "created_at": 1477041873,
        "started_at": 1477041873,
        "activated_at": 1477041873,
        "has_scheduled_changes": false,
        "object": "subscription",
        "due_invoices_count": 0,
        "shipping_address": {
          "first_name": "Konker",
          "last_name": "Markup",
          "email": "konker@gmail.com",
          "company": "Markup Enterprises",
          "phone": "0465727140",
          "line1": "Eerikinkatu 41 A 28",
          "city": "Helsinki",
          "state": "Uusimaa",
          "country": "FI",
          "zip": "00180",
          "object": "shipping_address"
        }
      },
      "customer": {
        "id": "eu-west-1:00000000-cafe-cafe-cafe-000000000000",
        "first_name": "Konker",
        "last_name": "Markup",
        "email": "konker@gmail.com",
        "phone": "0465727140",
        "company": "Markup Enterprises",
        "auto_collection": "off",
        "allow_direct_debit": false,
        "created_at": 1477041873,
        "taxability": "taxable",
        "object": "customer",
        "billing_address": {
          "first_name": "Konker",
          "last_name": "Markup",
          "email": "konker@gmail.com",
          "company": "Markup Enterprises",
          "phone": "0465727140",
          "line1": "Eerikinkatu 41 A 28",
          "city": "Helsinki",
          "state": "Uusimaa",
          "country": "FI",
          "zip": "00180",
          "object": "billing_address"
        },
        "card_status": "no_card",
        "account_credits": 0,
        "refundable_credits": 0,
        "excess_payments": 0
      }
    };
    /* eslint-enable comma-dangle, quote-props, quotes, indent, object-curly-spacing */

    const event = {
      id: 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM',
      payload: {
        event_type: 'subscription_created',
        webhook_status: 'not_configured',
        content: webhook_content,
      },
    };

    let response = null;
    let error = null;

    before(done => {
      bus.call(LAMBDA, event)
        .then(data => {
          response = data;
          done();
        })
      .catch(err => {
        error = err;
        done();
      });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error during test: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.not.be.null;
      expect(response).to.not.be.null;
    });
  });

  describe('profile-webhook-chargebee-customer-created', () => {
    //[xxx: linting disabled so that we can paste chargebee events in unchanged]
    /* eslint-disable comma-dangle, quote-props, quotes, indent, object-curly-spacing */
    const webhook_content = {
      "customer": {
        "id": "eu-west-1:00000000-cafe-cafe-cafe-000000000000",
        "first_name": "konker",
        "last_name": "markup",
        "email": "konker@gmail.com",
        "phone": "0465727140",
        "company": "markup enterprises",
        "auto_collection": "off",
        "allow_direct_debit": false,
        "created_at": 1477041873,
        "taxability": "taxable",
        "object": "customer",
        "billing_address": {
          "first_name": "konker",
          "last_name": "markup",
          "email": "konker@gmail.com",
          "company": "markup enterprises",
          "phone": "0465727140",
          "line1": "eerikinkatu 41 a 28",
          "city": "helsinki",
          "state": "uusimaa",
          "country": "fi",
          "zip": "00180",
          "object": "billing_address"
        },
        "card_status": "no_card",
        "account_credits": 0,
        "refundable_credits": 0,
        "excess_payments": 0
    }};
    /* eslint-enable comma-dangle, quote-props, quotes, indent, object-curly-spacing */

    const event = {
      id: 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM',
      payload: {
        event_type: 'customer_created',
        webhook_status: 'not_configured',
        content: webhook_content,
      },
    };
//console.log(JSON.stringify(event, null, 2));

    let response = null;
    let error = null;

    before(done => {
      bus.call(LAMBDA, event)
        .then(data => {
          response = data;
          done();
        })
      .catch(err => {
        error = err;
        done();
      });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error during test: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.not.be.null;
    });
  });

  describe('profile-webhook-chargebee-customer-created-bad', () => {
    //[XXX: linting disabled so that we can paste chargebee events in unchanged]
    /* eslint-disable comma-dangle, quote-props, quotes, indent, object-curly-spacing */
    const webhook_content = {
      "customer": {
        "id": "eu-west-1:00000000-cafe-cafe-cafe-000000000000",
        "auto_collection": "on",
        "allow_direct_debit": false,
        "created_at": 1476879060,
        "taxability": "taxable",
        "updated_at": 1476879060,
        "resource_version": 1476879060898,
        "deleted": false,
        "object": "customer",
        "billing_address": {
            "phone": "+358555666",
            "validation_status": "not_validated",
            "object": "billing_address"
        },
        "card_status": "no_card",
        "promotional_credits": 0,
        "refundable_credits": 0,
        "excess_payments": 0
    }};
    /* eslint-enable comma-dangle, quote-props, quotes, indent, object-curly-spacing */

    const event = {
      id: 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM',
      kpayload: {
        event_type: 'customer_created',
        webhook_status: 'not_configured',
        content: webhook_content,
      },
    };

    let response = null;
    let error = null;

    before(done => {
      bus.call(LAMBDA, event)
        .then(data => {
          response = data;
          done();
        })
      .catch(err => {
        error = err;
        done();
      });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error during test: [${error.type}]: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.not.be.null;
      expect(response.response).to.be.defined;
      expect(response.response).to.equal('OK');
    });
  });

  describe('profile-webhook-chargebee-badly-formed', () => {
    //[xxx: linting disabled so that we can paste chargebee events in unchanged]
    /* eslint-disable comma-dangle, quote-props, quotes, indent, object-curly-spacing */
    const webhook_content = {
      "customer": {
        "id": "eu-west-1:00000000-cafe-cafe-cafe-000000000000",
        "first_name": "konker",
        "last_name": "markup",
        "email": "konker@gmail.com",
        "phone": "0465727140",
        "company": "markup enterprises",
        "auto_collection": "off",
        "allow_direct_debit": false,
        "created_at": 1477041873,
        "taxability": "taxable",
        "object": "customer",
        "billing_address": {
          "first_name": "konker",
          "last_name": "markup",
          "email": "konker@gmail.com",
          "company": "markup enterprises",
          "phone": "0465727140",
          "line1": "eerikinkatu 41 a 28",
          "city": "helsinki",
          "state": "uusimaa",
          "country": "fi",
          "zip": "00180",
          "object": "billing_address"
        },
        "card_status": "no_card",
        "account_credits": 0,
        "refundable_credits": 0,
        "excess_payments": 0
    }};
    /* eslint-enable comma-dangle, quote-props, quotes, indent, object-curly-spacing */

    const event = {
      id: 'KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM',
      BAD_payload: {
        event_type: 'customer_created',
        webhook_status: 'not_configured',
        content: webhook_content,
      },
    };

    let response = null;
    let error = null;

    before(done => {
      bus.call(LAMBDA, event)
        .then(data => {
          response = data;
          done();
        })
      .catch(err => {
        error = err;
        done();
      });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error during test: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should not return empty', () => {
      expect(response).to.not.be.null;
    });
  });
};
