'use strict';

const TransportServiceAdapter = require('./TransportServiceAdapter');

// Use a different set of TSP data, based on dev vs. production
const tspData = require(process.env.TSP_DATASET_PATH);

/**
 * A factory class to create booking adapters based on given hints.
 * This version uses the static data files, but a drop-in replacement cancel
 * retrieve them e.g. from the database.
 */
class TransportServiceAdapterFactory {

  /**
   * Creates a Transport Service Adapter based on given agencyId
   *
   * @param {string} agencyId the name of the agency (e.g. HSL) that provides the service
   * @return {Promise} that resolves to TransportServiceAdapter matching the agency id
   */
  static createFromAgencyId(agencyId) {
    if (typeof agencyId !== 'string' || agencyId === '') {
      return Promise.reject(new Error(`Invalid agencyId '${agencyId}'`));
    }

    // Handle the case of a missing mapping
    const data = tspData[agencyId];
    if (!data) {
      const message = `No TSP adapter found with agencyId '${agencyId}'`;
      return Promise.reject(new Error(message));
    }

    const adapter = new TransportServiceAdapter(data);
    return Promise.resolve(adapter);
  }

  /**
   * Creates a Transport Service Adapter based on given leg information.
   * It uses the mode, start and end times & positions, ignoring the agencyId.
   *
   * @param {object} a valid leg JSON object
   * @return {Promise} that resolves to an Array of TransportServiceAdapters
   */
  /*static createFromLeg(leg) {
    return Promise.reject('Not implemented');
  }*/
}

module.exports = TransportServiceAdapterFactory;
