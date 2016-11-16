'use strict';

// External dependencies
const _cloneDeep = require('lodash/cloneDeep');
const _merge = require('lodash/merge');
const uuid = require('node-uuid');
const geoUtils = require('geojson-utils');

/**
 * Create a v1 UUID
 * @return {UUID} UUID v1
 * TODO Use users' public IP address or such for generating the first 6 bytes (now uses random)
 */
function createId() {
  return uuid.v1();
}

/**
 * Recursively visits and transforms the object and array values one-by-one,
 * executing the given function. This is loosely modeled around Visitor pattern.
 * The object is traversed in in-order, but only the leaves are processed.
 * Inherited propeties are not traversed nor available in the results.
 *
 * Note: This function will prune undefined values like JSON.stringify().
 * Note: This function will get stuck into endless loop on circular references.
 *
 * Callback will be called as follows:
 * callback(key, value, context);
 * In case of mapping an array, 'key' equals the current index.
 * In case of mapping a raw value (not part of any object), it is null
 *
 * @param {object} value - the object/array to visit
 * @param {function} callback - the transformation function to execute
 * @param {object} [key=undefined] - context parameter, used in recursive calls
 * @param {object} [context=undefined] - context parameter, used in recursive calls
 * @see https://en.wikipedia.org/wiki/Visitor_pattern
 * @see https://en.wikipedia.org/wiki/Tree_traversal#In-order
 */
function mapDeep(object, callback, key, context) {

  // Handle defaults
  key = key || undefined;
  context = context || undefined;

  // Handle the simple values (non-objects)
  if (typeof object !== 'object' || object === null) {
    return callback(object, key, context);
  }

  // Handle a complex case (Array): Convert numbers in nested objects
  if (Array.isArray(object)) {
    const transformed = [];
    object.forEach((value, index) => {
      const v = mapDeep(value, callback, index, object);
      if (typeof v === typeof undefined) {
        return;
      }

      transformed.push(v);
    });
    return transformed;
  }

  // Handle a complex case (Object); iterate key-value (k-v) pairs
  const transformed = {};
  for (let k in object) { // eslint-disable-line prefer-const
    if (!object.hasOwnProperty(k)) {
      continue;
    }

    const v = mapDeep(object[k], callback, k, object);
    if (typeof v !== typeof undefined) {
      transformed[k] = v;
    }
  }

  return transformed;
}

/**
 * Converts decimal numbers to fixed precision
 * Does not convert integers, but leaves them as-is.
 *
 * When supplying a negative number for digits, it rounds to tens.
 *
 * Note: There will be some loss of precision due to the underlying double math.
 *
 * @param {number} value - the input number
 * @param {integer} digits - the number of digits after decimal point
 * @return {number} - the input number in given precision.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round#PHP-Like_rounding_Method
 */
function toFixed(value, digits) {
  if (typeof value !== 'number') {
    throw new TypeError('The input value is not a number');
  }

  // Return integers as-is.
  if (Number.isInteger(value)) {
    return value;
  }

  // Do the conversion
  const factor = Math.pow(10, digits);
  const tempNumber = value * factor;
  const roundedTempNumber = Math.round(tempNumber);
  return roundedTempNumber / factor;
}

/**
 * Converts a JS object into an object that is safe to sign.
 * It removes the nulls, fixes the number precision to six decimals and
 * sorts the object fields. As a result, the object is safe to sign and
 * send forward.
 *
 * @param {object} object - The object to 'sanitize'
 */
function sanitize(object) {
  return mapDeep(object, (value, key, context) => {
    // Remove nulls except when they are in array or the value is in root level
    if (value === null && !Array.isArray(context) && typeof context !== typeof undefined) {
      // FIXME Special case: Keep the null amount, as it has a meaning
      if (key === 'amount') {
        return value;
      }

      return undefined;
    }

    // Remove empty string except when they are in array or the value is in root level
    if (value === '' && !Array.isArray(context) && typeof context !== typeof undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return toFixed(value, 6);
    }

    return value;
  });
}

/**
 * Creates a deep copy of the object
 *
 * @param {object} object the Object to clone
 */
function cloneDeep(object) {
  // TODO Node 4.3 does not accept ES6 rest parameters
  // TODO For now, delegate to lodash; later switch to transform when it works
  return _cloneDeep(object);
  /*return mapDeep(object, (value, key) => {
    return value;
  });*/
}

/**
 * Returns a deep clone of the given object without the values given.
 * Only works for top level properties.
 *
 * @param {object} object - the Object to return the values without
 * @param {Array} keys - The keys to remove (e.g. ['signature'])
 */
function without(object, keys) {
  const copy = cloneDeep(object);

  keys.forEach(key => {
    delete copy[key];
  });

  return copy;
}

/**
 * Performs a deep merge of two objects.
 *
 * @param {object} source The object to merge the values to
 * @param {object} delta The delta to apply on top of
 */
function merge(source, delta) {

  // Handle the case of source not existing - just return the delta
  if (typeof source === typeof undefined) {
    return delta;
  }

  if (typeof delta === typeof undefined) {
    return source;
  }

  // Use basic values as-is
  if (typeof delta !== 'object') {
    return delta;
  }

  if (delta === null) {
    return delta;
  }

  // TODO Node 4.3 does not accept ES6 rest parameters
  // For now, delegate to lodash
  return _merge(source, delta);
}

/**
 * Checks if the given value is empty string, null or undefined,
 * mainly for the purpose of validating API Gateway input
 *
 * @param value an arbitrary object
 * @return true if the value is empty string, undefined or null, false otherwise
 */
function isEmptyValue(value) {
  if (typeof value === typeof undefined || value === null || value === '') {
    return true;
  }

  return false;
}

/**
 * Checks if the given argument is empty.
 * This works for arrays, strings and objects.
 */
function isEmpty(x) {
  if (isEmptyValue(x)) {
    return true;
  }

  /* eslint-disable max-depth */
  if (x.hasOwnProperty('length')) {
    return x.length === 0;
  } else if (typeof x === typeof {}) {
    for (const prop in x) {
      if (x.hasOwnProperty(prop) && !isEmptyValue(x[prop])) {
        return false;
      }
    }
    return true;
  }
  /* eslint-enable max-depth */

  return false;
}
/**
 * Memoize the given non-promise function
 */
function memoize(fn) {
  const cache = {};

  //[XXX: Would like to use ... spread operator here]
  return function () {
    const args = Array.from(arguments);
    const key = `${fn.name}__${JSON.stringify(args)}`;

    if (!(key in cache)) {
      //[XXX: Would like to use ... rest/spread operator here]
      cache[key] = fn.apply(null, args);
    }
    return cache[key];
  };
}

/**
 * Memoize the given non-promise function
 */
function memoizePromise(fn) {
  const cache = {};

  return function () {
    const args = Array.from(arguments);
    const key = `${fn.name}__${JSON.stringify(args)}`;

    if (!(key in cache)) {
      return fn.apply(null, args)
        .then(result => {
          cache[key] = result;

          return result;
        });
    }
    return Promise.resolve(cache[key]);
  };
}

/**
 * Checks whether a given point is inside the polygon
 *
 * @param {object} location - a {lat,lon} pair
 * @param {object} polygon - a GeoJSON polygon
 * @return true if it is inside polygon, false otherwise
 */
function isInside(location, polygon) {
  const point = {
    type: 'Point',
    coordinates: [location.lon, location.lat],
  };
  return geoUtils.pointInPolygon(point, polygon);
}


module.exports = {
  cloneDeep,
  createId,
  merge,
  sanitize,
  toFixed,
  mapDeep,
  isEmptyValue,
  isEmpty,
  without,
  memoize,
  memoizePromise,
  isInside,
};
