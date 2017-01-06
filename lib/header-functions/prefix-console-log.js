'use strict';

const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// This will prefix all console functions with SERVERLESS_STAGE name and console Method
// Reason is that AWS Cloudwatch could not distinguish between stdout and stderr
module.exports = function () {
  if (!process.env.IS_TEST_ENVIRONMENT) {
    Object.keys(originalConsole).forEach(key => {
      console[key] = function () {
        const args = [];
        args.push( `[${process.env.SERVERLESS_STAGE}] ${key.toUpperCase()} :`);

        for ( let i = 0; i < arguments.length; i++ ) {
          args.push( arguments[i] );
        }

        originalConsole[key].apply(null, args);
      };
    });
  }
};
