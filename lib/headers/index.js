'use strict';

const MaaSError = require('../errors/MaaSError');

// Semver versioning regex, originally from https://github.com/sindresorhus/semver-regex
const VERSION_REGEX = /\b((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[\da-z\-]+(?:\.[\da-z\-]+)*)?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)\b/;
const [VERSION, S_MAJOR, S_MINOR, S_PATCH, BUILD] =
  VERSION_REGEX.exec(process.env.MAAS_API_VERSION);
const [MAJOR, MINOR, PATCH] = [S_MAJOR, S_MINOR, S_PATCH].map(v => parseInt(v, 10));

// Accept header that contains the version information
const ACCEPT_HEADER_VERSION_REGEX =
  /\bversion=((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[\da-z\-]+(?:\.[\da-z\-]+)*)?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)\b/;

/**
 * Validates that the the given accept header (e.g. what the client wants to receive)
 * matches the version server is willing to serve.
 *
 * Currently this tests against global env process.env.MAAS_API_VERSION, e.g. we have
 * a global version.
 *
 * @param {string} acceptHeader - The HTTP Accept header as sent by API gateway
 * @return {Promise<true|MaaSError>} Resolves to true or rejects with response 415
 */
function validateVersion(acceptHeader) {
  // eslint-disable-next-line no-unused-vars
  const [match, version, major, minor, patch, build] =
    ACCEPT_HEADER_VERSION_REGEX.exec(acceptHeader) || ['', '', '0', '0', '0', ''];

  // Follow the semver policy for matches (e.g. major version changes indicate API break)
  if (MAJOR === parseInt(major, 10) && MINOR >= parseInt(minor, 10) && PATCH >= parseInt(patch, 10)) {
    // In case of an exact build is defined, match it
    if (!build || BUILD === build) {
      return Promise.resolve(true);
    }
  }

  const message = `Unsupported API version '${version}' - expected ${VERSION} or compatible`;
  return Promise.reject(new MaaSError(message, 415));
}

module.exports = {
  validateVersion,
};
