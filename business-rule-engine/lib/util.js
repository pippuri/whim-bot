'use strict';


function printGroupedProvidersMap(groupedRoutesProvidersMap) {
  console.info('Grouped Providers Map');
  console.info('------------------------');
  Object.keys(groupedRoutesProvidersMap).forEach(mode => {
    console.info(`Mode: ${mode}`);
    groupedRoutesProvidersMap[mode].forEach((group, i) => {
      console.info(`\tGroup ${i}`);
      group.forEach((provider, i) => {
        console.info(`\t\tProvider: ${provider.providerName} (${provider.providerPrio})`);
      });
    });
  });
}


module.exports = {
  printGroupedProvidersMap,
};
