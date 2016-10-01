'use strict';

const jwt = require('jsonwebtoken');
const maasOperation = require('../../lib/maas-operation');
const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError');

module.exports.respond = function (event, callback) {
  const userToken = event.body.split('=').splice(1).join('=');
  try {
    const userData = jwt.verify(userToken, process.env.JWT_SECRET);
    if ( ! userData.zendeskJwt ) {
      throw new Error('Token did not contain required zendeskJwt key.');
    }
    maasOperation.fetchCustomerProfile(userData.userId)
      .then( profile => {
        let phoneNumbers = '' + ( profile.phone || '');
        phoneNumbers = phoneNumbers.replace( /[^\d]/, '', 'g');

        let name = phoneNumbers;
        if ( profile.firstName || profile.lastName ) {
          name = [profile.firstName, profile.lastName].filter( x => x ).join(' ');
        }

        const email = profile.email || 'whim.user+' + phoneNumbers + '@maas.global';

        const jwtPayload = {
          jti: utils.createId(),
          name: name,
          email: email,
        };

        const jwtResult = jwt.sign( jwtPayload, process.env.ZENDESK_JWT_SECRET );
        callback( null, { jwt: jwtResult } );
      } );
  } catch (_error) {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    callback(new MaaSError(`Could not verify token: ${_error.toString()}`, 400));
  }
};
