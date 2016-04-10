
var testLeaveAndArrive = require('./error-leave-and-arrive.js');
var testMissingFrom = require('./error-missing-from.js');
var testMissingTo = require('./error-missing-to.js');

describe('routes endpoint', function() {

    var handler = require('../../../routes/query/handler.js').handler;
    testMissingFrom(handler);
    testMissingTo(handler);
    testLeaveAndArrive(handler);

});
