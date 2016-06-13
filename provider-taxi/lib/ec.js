'use strict';

var fs = require('fs');
var path = require('path');
var pfxFile = path.resolve(__dirname, 'maas_maasfinland.p12');

module.exports = Object.freeze({
  TAXI_API_URL: 'https://maas.valopilkkupalvelu.fi',
  PFX: fs.readFileSync(pfxFile),
  PASSPHRASE: "auj']_kT9Xwm:4qI4/-\\",
  error: {
    UNSUPPORTED_LOCATION: 100,
    UNKNOWN_IDENTIFIER: 101,
    UNKNOWN_LOCATION: 103,
    OPERATOR_BLOCKED: 105,
    OPERATOR_UNKNOWN: 106,
    ORDER_ALREADY_RECEIVED: 108,
    UNSUPPORTED_DATETIME_FOR_LOCATION: 111,
    INVALID_PLATFORM: 112,
    UNKNOWN_ORDER: 113,
    TOO_LATE_TO_CANCEL_ORDER: 114,
    NOT_AUTHORIZED: 115,
    UNSUPPORTED_DISPATCH_CENTER: 116,
    SERVER_IN_PANIC_MODE: 117,
    CLIENT_VERSION_NOT_SUPPORTED: 118,
    LOCATION_WARNING: 119,
    INSUFFICIENT_ACCURACY: 120,
    MESSAGE_ERROR_VEHICLE_HAS_NOT_ACCEPTED: 200,
    MESSAGE_ERROR_ORDER_COMPLETED: 201,
    NO_PICKUP_LOCATION: 300,
    PREORDERING_NOT_SUPPORTED: 301,
    DESTINATION_ADDRESS_NOT_ALLOWED: 302,
    DESTINATION_ADDRESS_REQUIRED: 303,
    VEHICLE_TYPE_SELECTION_NOT_ALLOWED: 304,
    INVALID_VEHICLE_TYPE: 305,
    MISSING_PROVIDER_ORDER_ID: 306,
    MISSING_PHONE_NUMBER: 307,
  },
});
