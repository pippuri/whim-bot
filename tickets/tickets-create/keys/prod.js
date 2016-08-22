'use strict';

module.exports = ( new Date().getTime() > 1472459089355 ) ? require('./prod-latest') : require('./prod-transitional');
