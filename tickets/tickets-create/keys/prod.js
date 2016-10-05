'use strict';

module.exports = ( Date.now() > 1474793767503 ) ? require('./prod-latest') : require('./prod-transitional');
