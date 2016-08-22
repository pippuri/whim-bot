'use strict';

module.exports = ( new Date().getTime() > 1472460486197 ) ? require('./dev-latest') : require('./dev-transitional');
