'use strict';

module.exports = ( new Date().getTime() > 1475849804972 ) ? require('./test-latest') : require('./test-transitional');
