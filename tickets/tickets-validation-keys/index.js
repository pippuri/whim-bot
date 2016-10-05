/* eslint-disable indent*/

'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const publicKeysMap = { dev: [], test: [], alpha: [], prod: [] };
const publicKeys = publicKeysMap[process.env.SERVERLESS_STAGE];

module.exports.respond = (event, callback) => {
  if (!publicKeys) {
    const message = 'Unknown SERVERLESS_STAGE when initializing tickets-validation-keys';
    return callback(new MaaSError(message, 500));
  }

  return callback(null, { keys: publicKeys } );
};

publicKeysMap.prod.push( {
  validityStartMilliEpoch: 0,
  validityEndMilliEpoch: 1735682400000, // 2025
  publicKey: [
    '-----BEGIN PUBLIC KEY-----',
    'MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhANFOBbTs7lWIwI+bNmWlQO9iZn8m3C5h',
    'cJbUnAbWKtTpS9jIRnj1HebQ4ovETD7QV53XyPx+DrTaW2xx4uMijUxW4rbFoOe/',
    'zgzVUQON7YDY+xMBlB3/dB8aN3cm0NokqQIDAQAB',
    '-----END PUBLIC KEY-----',
  ].join('\n'),
} );

publicKeysMap.prod.push( {
	validityStartMilliEpoch: 1472461390304,
	validityEndMilliEpoch: 1474793767503,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALnxAV8kyxOG5xEZjW8AksLaPHOyRmU5
NvS7Rx75OBP3k8GX4uZeH9CCHw7Jg9Xpa8op1oBoO8z4kpJjO2LkYYyoLqPAF5V/
nWM5r5TWdMjPUKjTF5mIworalz014Xpq4QIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.alpha.push( {
	validityStartMilliEpoch: 1475079862293,
	validityEndMilliEpoch: 1475079894857,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAMwBnXEvH2Za7SfalsWD4C0ezYg+uMkK
IJNRavt96afZz/6NSI3TUSg4K/TqNbM8LdsutWEgC384bSKliptNgb2ff7eUDQSO
rftd+c4AyhUeqhV0NdrQGFGlnyzET/4FowIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.alpha.push( {
	validityStartMilliEpoch: 1475079894857,
	validityEndMilliEpoch: 1475081179029,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALVqcfX47NnLXglAYQUJ8X4+IWvOIscq
ALi5lenb5U+5qYWVKqfhtIhYhIogPKGkDDsXyCb6P9Y66kmquvSCu12+/i6ndCND
aDq9idYE5GpFVyA+BJ57BET0lENT2fNFRwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
	validityStartMilliEpoch: 1476247156059,
	validityEndMilliEpoch: 1476247351714,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAN/eUKaQ3A9UT6FrR0ODDHzEJiNtZley
r8qU62ZLpY8vI3z/5ChAXBVcMPyelFfqIY/2VkE7YQlomBrb/SYFcsxWF64ca3Kk
H+KtlMZwiYk5W5U1i51r8gyu9H792Nz8bQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
	validityStartMilliEpoch: 1476247351714,
	validityEndMilliEpoch: 1476247357075,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAJz386SpKtYcQkg60s1QKetDgyLu4Y41
St3yv2JKa1Mnv+Z7Rk5KnqTJh6mLis7Yejzc7BteAZ5myzNS4tPI5EyS63aLndY2
gL+66qiZSjI1P3ULIZz4D/BIt7jDY/susQIDAQAB
-----END PUBLIC KEY-----`,
} );
