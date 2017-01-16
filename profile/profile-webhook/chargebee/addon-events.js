'use strict';


function handle(payload, key, defaultResponse) {
  console.info('handleAddonEvents [IGNORED]');
  console.info(JSON.stringify(payload));
  return defaultResponse;
}

module.exports = {
  handle,
};
