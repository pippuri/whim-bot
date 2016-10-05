'use strict';

module.exports = ( Date.now() > 1476213210929 ) ? require('./test-latest') : require('./test-transitional');
