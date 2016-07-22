'use strict';

const jwt = require('jsonwebtoken');
const maasOperation = require('../../lib/maas-operation');
const utils = require('../../lib/utils');

module.exports.respond = function (event, callback) {
  const user_token = event.body.split('=').splice(1).join('=');
  let user_data = jwt.verify(user_token, process.env.JWT_SECRET);
  try {
    user_data = jwt.verify(user_token, process.env.JWT_SECRET);
    if ( ! user_data.zendesk_jwt ) {
      throw new Error('Token did not contain required zendesk_jwt key.');
    }
    maasOperation.fetchCustomerProfile(user_data.id).
      then( profile => {
        let phoneNumbers = '' + ( profile.phone || '');
        phoneNumbers = phoneNumbers.replace( /[^\d]/, '', 'g');

        let name = phoneNumbers;
        if ( profile.firstName || profile.lastName ) {
          name = [profile.firstName, profile.lastName].filter( x => x ).join(' ');
        }

        const email = profile.email || 'whim.user+' + phoneNumbers + '@maas.global';

        const jwt_payload = {
          jti: utils.createId(),
          name: name,
          email: email,
        };

        const jwt_result = jwt.sign( jwt_payload, process.env.ZENDESK_JWT_SECRET );
        callback( null, { jwt: jwt_result } );
      } );
  } catch (err) {
    callback('400: Could not verify token.');
  }
};
