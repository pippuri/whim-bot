'use strict';

(function() {

class RoutesController {

  constructor($http, $filter, $stateParams, API_BASE_URL) {
    this.$http = $http;
    this.$filter = $filter;
    this.from = $stateParams.from;
    this.to = $stateParams.to;
    this.API_BASE_URL = API_BASE_URL;
    this.provider = $stateParams.provider;
    this.routes = null;
    this.directUrl = '';
    this.findRoute(this.from, this.to);
  }

  findRoute(from, to) {
    this.directUrl = this.API_BASE_URL + '/routes?from=' + from + '&to=' + to + '&provider=' + this.provider;
    this.$http.get(this.directUrl)
    .then((response) => {
      this.routes = response.data;
    })
    .then(null, (err) => {
      this.error = err.data.errorMessage || JSON.stringify(err.data);
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('RoutesController', RoutesController);

})();
