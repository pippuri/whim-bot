'use strict';

module.exports = ( Date.now() > 1475081179029 ) ? require('./alpha-latest') : require('./alpha-transitional');
