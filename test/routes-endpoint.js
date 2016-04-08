
var testLeaveAndArrive = require('./routes-api/error-leave-and-arrive.js');
var testMissingFrom = require('./routes-api/error-missing-from.js');
var testMissingTo = require('./routes-api/error-missing-to.js');

describe('Routes endpoint', function() {

    var handler = require('../routes/query/handler.js').handler;
    testMissingFrom(handler);
    testMissingTo(handler);
    testLeaveAndArrive(handler);

});
