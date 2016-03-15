'use strict';

(function() {

class MainController {

  constructor($http, $filter) {
    this.$http = $http;
    this.$filter = $filter;
    this.from = '60.185034,24.9147957';
    this.to = '60.1883726,24.9574861';
    this.providers = ['tripgo', 'digitransit', 'here', 'hsl', 'matka'];
    this.provider = 'tripgo';
    this.routes = null;
    this.segmentTemplates = {};
    this.directUrl = '';
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
  .controller('MainController', MainController);

})();
