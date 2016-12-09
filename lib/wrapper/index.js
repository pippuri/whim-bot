'use strict';


module.exports = function(handler, event, context) {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    if (!process.env.IS_TEST_ENVIRONMENT) {
      Object.keys(originalConsole).forEach(key => {
        console[key] = function () {
          const args = Array.from(arguments);
          args.unshift(`[${process.env.SERVERLESS_STAGE}] ${key.toUpperCase()} :`);

          originalConsole[key].apply(null, args);
        };
      });
    }

    // Call the original handler
    return handler(event, context);
}
