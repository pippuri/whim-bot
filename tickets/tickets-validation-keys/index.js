'use strict';

const publicKeysMap = { dev: [], prod: [] };
let publicKeys;

if ( process.env.SERVERLESS_STAGE === 'dev' || process.env.SERVERLESS_STAGE === 'test' || process.env.SERVERLESS_STAGE === 'alpha') {
  publicKeys = publicKeysMap.dev;
} else if ( ( '' + process.env.SERVERLESS_STAGE ).indexOf('prod') === 0) {
  publicKeys = publicKeysMap.prod;
} else {
  throw new Error( 'Unknown SERVERLESS_STAGE when initializing tickets-validation-keys' );
}

module.exports.respond = (event, callback) => {
  return callback(null, { keys: publicKeys || [] } );
};

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 0,
  validityEndMilliEpoch: 1470748367398,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhANLriSaQ1mE4QSRusJ8AxqDNc98Wuvsd
VK7o2j4ST3Yvh5amStJPpmYfzRJ5vo3bzU0rRcZhO9ez9YsO9hP1QGGYnjTqKuSN
eMAKFhJ6Xew88q8OkvxMvsZbtQwQYTs0QwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1470748367398,
  validityEndMilliEpoch: 1735682400000, // 2025
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAPad/1cNq1sZr+Uxt6mNJGpbrxNNUeAd
7Mdwj/NLShpfZalJQKfiDuqmI2MYroRzkqsLqgvAuDuo/d0CGOTXRzNdrAVml5oR
xd75bQDz1BBO0yamLRw4B7/jatPxZZM0awIDAQAB
-----END PUBLIC KEY-----`,
} );

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
