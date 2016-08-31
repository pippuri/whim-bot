'use strict';

module.exports = ( new Date().getTime() > 1474793767503 ) ? require('./prod-latest') : require('./prod-transitional');
