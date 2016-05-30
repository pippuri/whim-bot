
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var LookupsClient = require('twilio').LookupsClient;
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();
var client = new LookupsClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_ACCOUNT_TOKEN);
var cognitoIdentity = new AWS.CognitoIdentity({ region: process.env.AWS_REGION });
Promise.promisifyAll(docClient);

Promise.promisifyAll(cognitoIdentity);

/**
 * Check if document exist in provided Table using HASH and RANGE key
 */
function documentExist(tableName, hashKey, hashValue, rangeKey, rangeValue) {

  if (!hashKey) {
    return Promise.reject(new Error('Required Hash Key Missing'));
  } else if (hashValue === '' || typeof hashValue === typeof undefined) {
    return Promise.reject(new Error('Missing Hash Value'));
  }

  var params = {
    TableName: tableName,
    Key: {},
  };

  params.Key[hashKey] = hashValue;

  if (rangeKey !== null) {
    if (rangeValue !== null) {
      params.Key[rangeKey] = rangeValue;
    } else {
      return Promise.reject(new Error('Missing RANGE Value'));
    }
  }

  return docClient.getAsync(params)
    .then((response) => {
      if (!_.isEmpty(response)) { // If not empty -> exist
        return Promise.resolve(true);
      } else {
        return Promise.resolve(false);
      }
    });
}

/**
 * Check phoneNumber validity with Twilio
 */
function checkPhoneNumber(phoneNumber) {
  var promise = new Promise(function (resolve, reject) {
    client.phoneNumbers(phoneNumber).get(function (error, number) {
      if (error) {
        reject(new Error('Invalid phone number'));
      } else {
        resolve(number);
      }
    });
  });

  return promise;
}

/**
 * Get/Create Cognito IdentityId
 * TODO give restriction for identity creation
 */
function getCognitoDeveloperIdentity(phoneNumber) {
  return checkPhoneNumber(phoneNumber)
    .then((response) => {
      var logins = {};
      logins[process.env.COGNITO_DEVELOPER_PROVIDER] = 'tel:' + response.phoneNumber;
      var options = {
        IdentityPoolId: process.env.COGNITO_POOL_ID,
        Logins: logins,
      };

      console.log('Getting cognito developer identity with', JSON.stringify(options, null, 2));

      return cognitoIdentity.getOpenIdTokenForDeveloperIdentityAsync(options);
    })
    .then(function (response) {
      return {
        identityId: response.IdentityId,
      };
    });
}

/**
 * Parse ChargeBee response package(s) to MaaS Schema
 * FIXME
 */
function parseChargebeePackage(input) {
  var output = [];

  var planContext = input.plan;

  planContext.price =  planContext.price / 100;
  output.push({
    id: planContext.id,
    name: planContext.name,
    invoiceName: planContext.invoice_name,
    price: planContext.price / 100,
    currency: planContext.meta_data.currency,
    formattedPrice: planContext.meta_data.currency + planContext.price,
    description: planContext.meta_data.description,
    pointGrant: planContext.meta_data.pointGrant,
    period: planContext.period,
    periodUnit: planContext.period_unit,
    chargeModel: planContext.charge_model,
    feature: planContext.meta_data.features,
    provider: planContext.meta_data.provider,
  });
  return output;
}

/**
 * Parse Chargebee response addons to MaaS Schema
 * FIXME
 */
function parseChargebeeAddon(input) {

  var output = [];
  for (var j = 0; j < input.list.length; j++) {
    var addonContext = input.list[j].addon;

    output.push({
      id: addonContext.id,
      name: addonContext.name,
      invoiceName: addonContext.invoice_name,
      price: addonContext.price / 100,
      period: addonContext.period,
      periodUnit: addonContext.period_unit,
      chargeModel: addonContext.charge_model,
    });
  }

  return output;
}

module.exports = {
  checkPhoneNumber: checkPhoneNumber,
  getCognitoDeveloperIdentity: getCognitoDeveloperIdentity,
  documentExist: documentExist,
  parseChargebeePackage: parseChargebeePackage,
  parseChargebeeAddon: parseChargebeeAddon,
};
