'use strict';

const VALID_ID = 'dummy';


module.exports = {
  id: VALID_ID,

  matches(key) {
    return (key === VALID_ID);
  },

  handlePayload(payload, key, defaultResponse) {
    console.log(payload, key);
    return defaultResponse;
  },
};
