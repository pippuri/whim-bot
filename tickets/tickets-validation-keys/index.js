/* eslint-disable indent*/

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

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471700827706,
  validityEndMilliEpoch: 1471935852620,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALbzsWp53HI18igstXwlA5mB6TPtXSCQ
t6Hl9bpqylm3yMkb7DpXaThZoxr5dMB375h5H1+P7uouFLjKn75koXeWXeY+ntUp
30LHa6JASB3QwHPu15pNg+Y4SS48rEmnOwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471935852620,
  validityEndMilliEpoch: 1471936628242,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAM7hfd864tWxPiWYklTUkmPOGIDz9sTb
hnsiEEWr37R2euPaGbWLBiVTbuWvN9ZLPRBJQ31CgXkzFyAHQCk9t90XegBDy8XV
+DZiybzhDdxrP9j+otv8677vKz6BQlWr8wIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471936628242,
  validityEndMilliEpoch: 1471936662510,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALkFykSgbLqPiFpOWH9E998jrZkkhuvp
y/CzUesZRwt/CvmWmj7TAgI036ur3Arf7X6L3zbzEAJTXLZPOvBbFvTyS5HsqTkQ
IWcRqwYuTNfeferdGUgbF0awJKW2PGu28wIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471936662510,
  validityEndMilliEpoch: 1471936774188,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAM2QGRXCcOWj3mGs+hUSScRULQEAcC1g
b1mw342S/4ZS1ZuvXr2twbDufwtHpWBL2wIdDCzozzqDsC95aSSSOQe9CkqUu+Gx
0hJd62/ZcvT9dn9nCODrnt94n+byZ0daDQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471936774188,
  validityEndMilliEpoch: 1472714401264,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAKTvi5Cx+ghPQm1pyZeDUOtvytPvj2qg
A6ZoBv8+BAyTWowze9GiP/vvogN/Elt4mSz/WIU0NRLFkWi+NMplCN0K+r0XvugN
Wuun+VZEdJ8qfVveJPXxsKuIf4JCrRr/UwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1472714401264,
  validityEndMilliEpoch: 1480490711689,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAPLH9Cu++ti7p8bFBPxXISqrR4juoh9P
22Hx+JkAYAeoSprPvzdBckCCAjQ/sSg82ZzfWXM2hFXTrxKvN8omH1qpL12zUxY5
JyEZpQ/J4Q1IKKKqVETukg1rqe71LiaHIwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1472714401264,
  validityEndMilliEpoch: 1480492343442,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALe8vOgCx/yTaFowMpni9199AiqXW5Cw
xrm1pktEkcAY08kJxn2EvoKSfcnuwz8whyqQiOuSlwt29p3vz+0yGEKRgEiRzgYx
smpWgAUBrO2oe73VbTrBwzOVTvWgCjuNgQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1480492343442,
  validityEndMilliEpoch: 1471938785282,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhANDQWBCg2WiW6oaCWWbaC4B74q65UlYN
v67nqghH+B0Ek3fcKY3Q7B1T5RAfJ2lpyr800Zdu0Er6zmZPa6lXOzmlJ8yR7Om9
0UcqKSEj24lIN02NQ0u3Aup7fO4GYi9nUQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471938785282,
  validityEndMilliEpoch: 1472716390044,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhANrRyCi5MvGA5Sid4JQxpNjuqyZA+ney
xmmDRtGRXnGxGSvVFHx+x/PODNcviMBXwTqqvjF/uF1KxaEoul4RisObVBbq6PGu
gtB/e1OUmZqoWTKixO0CZBU7hrhyGaG0PQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1472716390044,
  validityEndMilliEpoch: 1471938907984,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAMGceJm5FyX7a6HrjOr+454SC4bMEdx0
u9ZXWL2Cbwjoe1rktCH4zxg+hYS31aWkoM0eeMh4Bz7SteDs58UjojhBNlyIMtiB
Lq8VVlXavEmAulwLsAvC7rcBj+MwjzamIQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471938907984,
  validityEndMilliEpoch: 1471938911432,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALE4XQrG3EofyKyvRRPHksLVHkm1PSMt
g8gduuuKj+l3Ax5oEbomca52Yxcb39u6P50iQOOkRBixzmVNIgxWhCvjxjojvKYI
Yqs4o+ibfn8JKwX/x9o35h+JP7LDZicjewIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471938911432,
  validityEndMilliEpoch: 1471938915579,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAKRsWuOaxNl2TNa60tmH4l2K1/h3zmn9
w6+xMckZNiB+f7zHBYR6PXXKp6eSRIAbAWThhNn0PcDCV6A1nWoXCfIiSu4rbHWF
Sni4f5MF1DG+J9B28u4r5xh8gYg8ryejyQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1471938915579,
  validityEndMilliEpoch: 1472457572528,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAMtYndIaxa0s72HuDpiBoO9Y18w14GOA
yrHyo0G6vVcCKc8Mxnp8eKA5eTc4xLulCE7Gly7uyGdzmaSlACqqw31Mb75fOZxI
J9qdhFE+lT5Jv5TRJZWO9fF2zwujn30diQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1472457572528,
  validityEndMilliEpoch: 1472457655863,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAJ6ePCjDpG+kF597DvHjzxzm6C2NOT68
bVuKYMoK5SLqJ9a/KUVRbanO568pryb3sqIDehBtKfbPgatCxVRvr1qMV18uGDDu
LNbxSeUy8TYuuJGT2zVYEt9v0z4RgZtKJQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1472457655863,
  validityEndMilliEpoch: 1472457720849,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALqoPyl+IpmmILJvwt1zqh5sqPQjEfFt
pQTDPxx5JT2BZenGuF2wyMD11ZbO85vcJVB4SPehgv4XHgCwZkm+M/8Dg4TulCFF
LuIHILWgIRBQWcdCAq2cKZyLg+yeB7RLdQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1472457720849,
  validityEndMilliEpoch: 1472457878127,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAMuW9XG+6n6NobUDVSagSPqwlZXoEWIu
vCYvIU9cfGORcxVXCvbBum3xxjvrV31GrVY6ILuATNlOD6wyEk2OWzSs3rIFk7ft
/h1qiMsNg83ukNHo6iuUUgFCElqWyDXwSwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.prod.push( {
  validityStartMilliEpoch: 1471596254000,
  validityEndMilliEpoch: 1472458018130,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhANfU3V6Z/L0k7seTc3yFO3idmjiIJ6hi
XfqUZT8zmECgGnluA4Xu7TNzdtBAHYKyo0co8bAfldUx6X+sdEVZGxGIdstVBSSe
qBuXYlKqSVQ2DvdT6BzwLQoTUtCA2zRo5wIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.prod.push( {
  validityStartMilliEpoch: 1472458018130,
  validityEndMilliEpoch: 1472458034530,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALKy11vJ/5PtzuMqC1mVIw6hEaBShCVu
NDIziuby4leNZmic4ntmdF9x6/kJrkSAeJfcTJayu5e/jOFUpfyPysOYEpT33/JM
9aOrU4in+KL40GnT6huC7+Pc6rdc9pimQwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
  validityStartMilliEpoch: 1472457878127,
  validityEndMilliEpoch: 1472458346832,
  publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAKhop7f1NE7nntdsqGFpTC9ZADohJUpW
ky8aw8i0Xt0YwlbtqhYcvE0OtkfJEUUzAWgxrpiVUNSJGBjJuF487Ed3rFDTKMCq
S7YXj/GiyEdoqMZxYIjL5lorPNV3ZGk5lwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.prod.push( {
	validityStartMilliEpoch: 1472458034530,
	validityEndMilliEpoch: 1472459089355,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAMEeSUOZ1KR24lyN2WIyfGh9uTBqp92y
t0nI1I5ixnGlKMCPY04RV04nOdObPtrSdjcpBcHgFGjy9NXnPuQ9zY+unMt8GH9Y
6fQctPhNuMbRdD30AqFgVWBoGUf14oKjwQIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
	validityStartMilliEpoch: 1472460486197,
	validityEndMilliEpoch: 1472461341993,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhALNM6uML37NQEt7XpQBt1CixBu+6LyQn
WSzpDWYRiXdwn0XCMwhMPa7jmOBlBGrh6H2aNKpCM9dPPus9vXytA+rfb9F1+hip
T9DkEjRTqPq1Xi777vq2DyG8Tx3xCbUXXwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.prod.push( {
	validityStartMilliEpoch: 1472459089355,
	validityEndMilliEpoch: 1472461390304,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAMNW+UXmneOH/AsOPfVlZTyfaeXzKyol
zNeMd9vc+tDnqCFsX4NkUyTF+5BBU8P0Ak2uHL8e3LoSvotZ3PqSAbFSIOlumo6c
Eb7XSshMvL7Iva7wNmS06CIiVtgIoHlofwIDAQAB
-----END PUBLIC KEY-----`,
} );

publicKeysMap.dev.push( {
	validityStartMilliEpoch: 1472461341993,
	validityEndMilliEpoch: 1472461516884,
	publicKey: `-----BEGIN PUBLIC KEY-----
MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAMP7RF8Nrjyr+xk/pYnmDl6ZHrEfcISE
zWI0o4wINcOS7JN3ZcpaXJruGFT27zcSk3NltFlPFyPsmEF787q3r3SY3kaedZuj
HYiIZWYtItbZNk37KFkQk6wvQoRbq+AhYQIDAQAB
-----END PUBLIC KEY-----`,
} );
