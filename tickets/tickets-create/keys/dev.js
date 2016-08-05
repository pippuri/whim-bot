'use strict';

// Created with the following:
// ssh-keygen -t rsa -b 768 -f dev.key
// To generate public key:
// openssl rsa -in dev.key -pubout -outform PEM -out dev.key.pub

module.exports.key = [
  '-----BEGIN RSA PRIVATE KEY-----',
  'MIIBygIBAAJhANLriSaQ1mE4QSRusJ8AxqDNc98WuvsdVK7o2j4ST3Yvh5amStJP',
  'pmYfzRJ5vo3bzU0rRcZhO9ez9YsO9hP1QGGYnjTqKuSNeMAKFhJ6Xew88q8OkvxM',
  'vsZbtQwQYTs0QwIDAQABAmAQSbokrUiw50w4iQfAr6mnH1aUYsf7vm8ctsSryHQ0',
  'd0UsQBlFFnuOJWSLybUKdW/IYvx9VGmmJIEBxYek4xaf7fr0d1xgLqdCZnYlTSHQ',
  'm3332AzSEwohTijg6pmzyukCMQDpvQ1xl4JJbqxsbVJJfYF7xlBFwqdp3miUyZ09',
  'KxMcGf2VH5Fh/5or0zCcpeUt5J8CMQDnAiFzpgOuos5KW8OJLcSC87Hp+pqeZNXy',
  'AZHiPrH29/vC4SncRLxirNOX9Y5kyd0CMAuVgwUOLTbWdVUqVdmujqxDt9a9Pu7Q',
  'Rv6Yv2I4sEnEP/0UA3CH6mwhm1coIaOUoQIxAKjFHbtoJniH6T7aG9k03sTtVaYj',
  'uKLP+J5+Fx67vzk3o2+VIQgUD63npg73D7kC4QIwfsbtr2Lt7Z4gNlBCg5PQIXXJ',
  'DTwz7OdHScyr6rlI/3SsSzghoQUQPI1N40H9ESjZ',
  '-----END RSA PRIVATE KEY-----',
].join('\n');
