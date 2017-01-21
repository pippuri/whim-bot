'use strict';

// Point to EUR conversion rates - currently static, but could be e.g. in a S3
// bucket. The suggestion is to use one normalised currency (EUR), assign the
// cost, and estimate the costs of other currencies in relation to that.
const POINT_COST_EURO = 0.05;

/**
 * This class encapsulates the pricing logic for doing conversions
 * between point and monetary costs.
 *
 * This deprecates the old point-pricing logic which assumed the conversions
 * are done by a Chargebee addon. This implementation leaves space for more
 * complex calculations.
 */
class Pricing {

  /**
   * Does the point conversion from monetary cost to point cost.
   * This is an async API, because in the future we can expect to have a 3rd
   * party currency conversion system in use, or we may dynamically update
   * the point conversion ratios.
   *
   * Round to nearest full points.
   *
   * @param {number} cost - The monetary cost
   * @param {string} currency - The monetary currecy unit (e.g. EUR)
   * @return {Promise<number>} The computed cost.
   */
  static convertCostToPoints(cost, currency) {
    return new Promise((resolve, reject) => {
      if (typeof cost !== 'number') {
        throw new TypeError(`Invalid cost '${cost}' specified, expected a number`);
      }

      // Note: Points rounded down
      switch (currency) {
        case 'EUR':
          return resolve(Math.floor(cost / POINT_COST_EURO));
        default:
      }
      const message = `Unsupported currency \'${currency}\', expecting EUR`;
      return reject(new TypeError(message));
    });
  }

  /**
   * Does the point conversion from point cost to euro cost. This is the inverse
   * operation of convertCostToPoints and implemented as one.
   *
   * @param {number} points - The point cost
   * @param {string} currency - The monetary currecy (e.g. EUR) to convert to
   * @return {Promise<number>} The computed monetary cost.
   */
  static convertPointsToCost(points, currency) {
    // Do the by '100' division trick to get max. two decimals
    return Pricing.convertCostToPoints(1, currency)
      .then(pointsPerEur => Math.ceil(100 * points / pointsPerEur) / 100);
  }
}

module.exports = Pricing;
