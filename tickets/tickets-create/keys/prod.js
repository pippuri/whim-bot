'use strict';

module.exports = ( new Date().getTime() > 1470748367398 ) ? require('./prod-latest') : require('./prod-transitional');
