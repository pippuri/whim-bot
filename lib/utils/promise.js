'use strict';


/**
 * A simple alternative to Bluebird promisify function
 * Expects the input function to follow the node conventions of accepting
 * a callback as the last parameter with the signature (err, data)
 *
 * @param {object} func - The callback-based function you want to promisify
 * @param {object} thisArg - The optional `this` context to use for calling func
 * @return {function} - The promisified function
 */
function promisify(func, thisArg) {
  return function () {
    // Get the arguments to pass to func
    const args = Array.from(arguments);

    // Start a Promise that will be returned
    return new Promise((resolve, reject) => {
      // A callback to reject/resolve the promise
      const cb = (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      };

      // Call func with the arguments and the callback
      func.apply(thisArg, args.concat(cb));
    });
  };
}


module.exports = {
  promisify,
};
