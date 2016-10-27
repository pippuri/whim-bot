'use strict';

function wrapToEnvelope(profile, event) {
  return {
    response: profile,
  };
}

module.exports = {
  wrapToEnvelope,
};
