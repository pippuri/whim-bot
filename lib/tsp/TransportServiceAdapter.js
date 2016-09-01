'use strict';

const URL = require('url');
const Promise = require('bluebird');
const request = require('request-promise-lite');
const utils = require('../utils');
const TSPError = require('./TSPError');

/**
 * An encapsulation of TransportServiceProvider that handles the operations
 * to create, retrieve, list and cancel the bookings of the associated TSP.
 */
class TransportServiceAdapter {

  /**
   * A factory method that constructs the TSP adapter.
   * Object contents: agencyId, baseUrl, endpoints: reserve, retrieve (optional),
   * query (optional), cancel (optional),
   *
   * @param {object} config a configuration object that nests the TSP configuration
   */
  constructor(config) {
    // Perform a sanity check
    TransportServiceAdapter.validateConfiguration(config);

    // Assign the data object with a frozen copy
    this.config = Object.freeze(config);
  }

  /**
   * Validates the given TSP configuration (an object consiting of URL and endpoints)
   * Object contents: baseUrl (mandatory), endpoints: get, post,
   * put (optional), delete (optional).
   *
   * @param {object} config The configuration object
   */
  static validateConfiguration(config) {
    const baseUrl = config.baseUrl;
    const endpoints = config.endpoints;

    // Assert we have a working configuration
    if (typeof baseUrl !== 'string') {
      throw new Error(`Invalid or missing baseUrl '${baseUrl}' in config ${JSON.stringify(config)}`);
    }

    if (typeof endpoints !== 'object') {
      throw new Error(`Invalid or missing endpoints '${endpoints}' in config ${JSON.stringify(config)}`);
    }

    return true;
  }

  static _toTSPFormat(booking) {
    const copy = utils.cloneDeep(booking);

    return {
      leg: copy.leg,
      meta: copy.meta,
      terms: copy.terms,
      customer: copy.customer,
    };
  }

  static _fromTSPFormat(tspResponse) {
    // Make a copy of the booking, because we do not want to change it
    const copy = utils.cloneDeep(tspResponse);

    return {
      tspId: copy.tspId,
      terms: copy.terms,
      token: copy.token,
      meta: copy.meta,
      leg: copy.leg,
      options: copy.options,
    };
  }

  /**
   * Determines whether this adapter supports the given operation
   *
   * @param {string} operation the operation (reserve, retrieve, cancel, query)
   * @return {boolean} true if the operation is supported, false otherwise
   */
  supportsOperation(operation) {
    if (this.config.endpoints[operation]) {
      return true;
    }

    return false;
  }

  query(params) {
    const query = params ? {
      mode: params.mode,
      from: params.from ? params.from.join(',') : undefined,
      to: params.to ? params.to.join(',') : undefined,
      startTime: params.startTime,
      endTime: params.endTime,
      fromRadius: params.fromRadius,
      toRadius: params.toRadius,
    } : undefined;

    return this._handleRequest('query', null, null, query);
  }

  reserve(booking) {
    return this._handleRequest('reserve', null, booking, null);
  }

  retrieve(tspId) {
    return this._handleRequest('retrieve', tspId, null, null);
  }

  cancel(tspId) {
    return this._handleRequest('cancel', tspId, null, null);
  }

  /**
   * Retrieves the name (practically agencyId) of the adapter
   */
  get name() {
    return this.config.agencyId;
  }

  /**
   * Validates if the given operation exists and maps it to a method
   * Resolves with undefined if all is good, rejects with TSPError if validation fails.
   *
   * @param {string} operationName The name of the operation to validate
   * @return {Promise} resolving to request.get, post, put or delete, or reject with TSPError
   */
  _mapToMethod(operationName) {
    // Pick the HTTP method
    const methods = {
      reserve: request.post,
      retrieve: request.get,
      query: request.get,
      cancel: request.del,
    };

    if (!this.supportsOperation(operationName)) {
      const message = `Unsupported operation '${operationName}'`;
      return Promise.reject(new TSPError(message, this));
    }

    if (!methods[operationName]) {
      const message = `No mapping available for operation '${operationName}'`;
      return Promise.reject(new TSPError(message, this));
    }

    return Promise.resolve(methods[operationName]);
  }

  /**
   * Casts a RequestError into a more semantic TSP error
   *
   * @param {RequestError} The RequestError to check
   * @return {TSPError} with interpreted RequestError
   */
  _handleRequestError(error) {
    let message;

    // Rethrow the error if it is of unknown type (=runtime error)
    if (!(error instanceof request.RequestError)) {
      return Promise.reject(error);
    }

    switch (error.statusCode) {
      case 404:
        message = 'Resource not found';
        break;
      case 403:
        message = `Invalid TSP request: ${error.message}`;
        break;
      case 500:
        message = 'TSP failed to fulfill the request';
        break;
      default:
        message = 'Unknown TSP error';
    }

    return Promise.reject(new TSPError(message, this));
  }

  /**
   * Handles the request based on the given method, endpoint, path and body
   *
   * @param {string} operation the operation to execute
   * @param {string} tspId the optional ID to append to the request path
   * @param {object} booking the booking that may be used within the request
   * @param {object} query the query hash that will be used as the query string
   * @return {Promise} A promise, encapsulating the formatted response, or TSPError
   */
  _handleRequest(operation, tspId, booking, query) {
    const body = (booking) ? TransportServiceAdapter._toTSPFormat(booking) : undefined;

    return this._mapToMethod(operation)
      .then(method => {
        // Construct a full URL based on the params
        const operationPath = this.config.endpoints[operation];
        const appendedPath = (tspId) ? URL.resolve(operationPath, tspId) : operationPath;
        const url = URL.resolve(this.config.baseUrl, appendedPath);

        // Form the options
        const options = {
          json: true,
          headers: this.config.headers,
          body: body,
          verbose: true,
          qs: query,
        };

        // We need to return Bluebird promise instead of native one, hence wrapping
        return new Promise((resolve, reject) => {
          method(url, options).then(resolve, reject);
        })
        .then(response => {
          console.info(`Executing request url '${url}', operation '${operation}': SUCCESS`);
          return Promise.resolve(TransportServiceAdapter._fromTSPFormat(response));
        }, error => {
          console.warn(`Executing request url '${url}', operation '${operation}': FAILURE`);
          return this._handleRequestError(error);
        })
        .finally(() => {
        });
      });
  }
}

module.exports = TransportServiceAdapter;
