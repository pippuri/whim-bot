'use strict';

(function() {

class RoutesController {

  constructor($http, $filter, $stateParams) {
    this.$http = $http;
    this.$filter = $filter;
    this.from = $stateParams.from;
    this.to = $stateParams.to;
    this.provider = $stateParams.provider;
    this.routes = null;
    this.directUrl = '';
    this.findRoute(this.from, this.to);
  }

  findRoute(from, to) {
    this.directUrl = 'https://api.dev.maas.global/routes?from=' + from + '&to=' + to + '&provider=' + this.provider;
    this.$http.get(this.directUrl)
    .then((response) => {
      this.routes = response.data;
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('RoutesController', RoutesController);

})();
