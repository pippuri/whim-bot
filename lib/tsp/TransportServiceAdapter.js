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
      // Mandatory
      leg: copy.leg,
      customer: copy.customer,
      // Optional: may be returned by info from bookings-options call
      meta: copy.meta,
      terms: copy.terms,
    };
  }

  static _fromTSPFormat(tspResponse, includeState) {
    // Make a copy of the booking, because we do not want to change it
    const copy = utils.cloneDeep(tspResponse);
    const response = {
      tspId: copy.tspId,
      terms: copy.terms,
      token: copy.token,
      meta: copy.meta,
      leg: copy.leg,
      options: copy.options,
    };

    if (includeState) {
      response.state =  copy.state;
    }

    return response;
  }

  /**
   * Validates the received response.
   *
   * @param {object} response the response object
   * @param {boolean} aggregate whether to check if it is an aggregate object
   */
  _validateResponse(response, aggregate) {

    if (typeof response !== 'object' || response === null) {
      const message = `Invalid TSP response; expected object, got '${JSON.stringify(response)}'`;
      return Promise.reject(new TSPError(message, this));
    }

    if (!aggregate && typeof response.tspId !== 'string') {
      const message = `Invalid TSP response; expected string, got '${response.tspId}'`;
      return Promise.reject(new TSPError(message, this));
    }

    if (!aggregate) {
      // Nothing more to validate for simple responses
      return Promise.resolve(response);
    }

    // TODO Validate aggregate contents
    if (!Array.isArray(response.options)) {
      const message = `Invalid TSP response; expected options to be an array, got '${response.options}'`;
      return Promise.reject(new TSPError(message, this));
    }

    return Promise.each(response.options, opt => {
      if (typeof opt !== 'object') {
        const message = `Invalid TSP response; expected options to nest objects, got '${response.options}'`;
        return Promise.reject(new TSPError(message, this));
      }
      return Promise.resolve();
    })
    .then(() => response);
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

    return this._handleRequest('query', null, null, query)
      .then(response => this._validateResponse(response, true));
  }

  reserve(booking) {
    const b = booking;

    if (typeof b !== 'object' || b === null) {
      return Promise.reject(new TSPError(`Invalid booking '${JSON.stringify(booking)}'; must be an object`, this));
    }

    if (typeof b.leg !== 'object' || b === null) {
      return Promise.reject(new TSPError(`Invalid booking.leg '${JSON.stringify(booking.leg)}'; must be an object`, this));
    }

    if (typeof b.customer !== 'object' || b === null) {
      return Promise.reject(new TSPError(`Invalid booking.customer '${JSON.stringify(booking.customer)}'; must be an object`, this));
    }

    return this._handleRequest('reserve', null, booking, null)
      .then(response => this._validateResponse(response));
  }

  retrieve(tspId) {
    if (typeof tspId !== 'string') {
      return Promise.reject(new TSPError(`Invalid tspId '${tspId}'; must be a string`, this));
    }

    return this._handleRequest('retrieve', tspId, null, null)
      .then(response => this._validateResponse(response));
  }

  cancel(tspId) {
    if (typeof tspId !== 'string') {
      return Promise.reject(new TSPError(`Invalid tspId '${tspId}'; must be a string`, this));
    }

    // No validation needed, we don't do anything with the response
    return this._handleRequest('cancel', tspId, null, null);
  }

  /**
   * Retrieves the unique identifier of the adapter
   *
   * @return string unique identifier for the adapter (usually agencyId)
   */
  get id() {
    return this.config.id;
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
        const permitState = operation === 'retrieve';

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
          return Promise.resolve(TransportServiceAdapter._fromTSPFormat(response, permitState));
        }, error => {
          console.warn(`Executing request url '${url}', operation '${operation}': FAILURE`);
          return this._handleRequestError(error);
        });
      });
  }
}

module.exports = TransportServiceAdapter;
