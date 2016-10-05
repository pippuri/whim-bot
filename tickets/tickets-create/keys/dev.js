'use strict';

module.exports = ( Date.now() > 1476247357075 ) ? require('./dev-latest') : require('./dev-transitional');
