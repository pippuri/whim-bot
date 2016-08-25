'use strict';

module.exports = ( new Date().getTime() > 1472461390304 ) ? require('./prod-latest') : require('./prod-transitional');
