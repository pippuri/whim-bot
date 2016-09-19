'use strict';

const URL = require('url');
const Promise = require('bluebird');
const request = require('request-promise-lite');
const utils = require('../utils');
const TSPError = require('./TSPError');

const validator = require('../validator');
const querySchema = require('maas-schemas/prebuilt/tsp/booking-options-list/response.json');
const reserveSchema = require('maas-schemas/prebuilt/tsp/booking-create/response.json');
const retrieveSchema = require('maas-schemas/prebuilt/tsp/booking-read-by-id/response.json');
const cancelSchema = require('maas-schemas/prebuilt/tsp/booking-cancel/response.json');

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
   * @param {object} schema the schema to validate against
   * @param {object} response the response object
   * @param {request} the original request (for error reporting)
   * @return {Promise} resolving to the response, or reject with TSPError
   */
  _validateResponse(schema, response) {
    return validator.validate(schema, response)
      .catch(error => {
        console.warn(`[TSP] Caught a response validation error: ${error.message}`);
        console.warn(error.stack);

        const message = `[TSP] Invalid Response: ${error.message}`;
        return Promise.reject(new TSPError(message, this));
      });
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

  /**
   * Queries the available options from the TSP.
   *
   * Mandatory: mode, startTime, endTime, fromRadius, toRadius
   * Optional: from, to
   *
   * @param {object} params a set of key-value pairs given above
   * @return {Promise} resolving into an array of bookings or TSPError
   */
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
      .then(response => this._validateResponse(querySchema, response));
  }

  /**
   * Reserves the given booking. Practically creates a new booking
   * through the TSP.
   *
   * @param {object} booking that is to be reserved
   * @return {Promise} updated booking data w/ state 'RESERVED' & tspId
   */
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
      .then(response => this._validateResponse(reserveSchema, response));
  }

  /**
   * Retrieves a delta for the TSP. The TSP may return with a full
   * or partial booking object. The TSP always returns with at
   * minimum the current state, potentially with updated
   * leg, terms or token information.
   *
   * @param {string} tspId of the booking to retrieve
   * @return {Promise} an update delta of the new TSP status.
   */
  retrieve(tspId) {
    if (typeof tspId !== 'string') {
      return Promise.reject(new TSPError(`Invalid tspId '${tspId}'; must be a string`, this));
    }

    return this._handleRequest('retrieve', tspId, null, null)
      .then(response => this._validateResponse(retrieveSchema, response));
  }

  /**
   * Cancels the booking.
   *
   * @param {string} tspId of the booking to retrieve
   * @return {Promise} a state SUCCESS if needed, or reject with error
   */
  cancel(tspId) {
    if (typeof tspId !== 'string') {
      return Promise.reject(new TSPError(`Invalid tspId '${tspId}'; must be a string`, this));
    }

    // No validation needed, we don't do anything with the response
    return this._handleRequest('cancel', tspId, null, null)
      .then(response => this._validateResponse(cancelSchema, response));
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
   * Resolves with undefined if all is good, rejects with TSPError if validation
   * fails.
   *
   * @param {string} operationName The name of the operation to validate
   * @return {Promise} with results of get, post, put or delete, or TSPError
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

    // Log the original error
    console.warn(`[TSP] Caught a request error: ${error.message}, ${JSON.stringify(error)}`);
    console.warn(error.stack);

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
   * @return {Promise} Formatted response, or TSPError
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

        // Wrap into Bluebird promise instead of native one
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
