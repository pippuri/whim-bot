'use strict';

module.exports = ( new Date().getTime() > 1470748367398 ) ? require('./dev-latest') : require('./dev-transitional');
