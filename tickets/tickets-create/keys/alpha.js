'use strict';

module.exports = ( new Date().getTime() > 1475081179029 ) ? require('./alpha-latest') : require('./alpha-transitional');
