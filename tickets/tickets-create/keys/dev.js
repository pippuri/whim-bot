'use strict';

module.exports = ( new Date().getTime() > 1472461516884 ) ? require('./dev-latest') : require('./dev-transitional');
