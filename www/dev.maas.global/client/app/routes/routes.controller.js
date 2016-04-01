'use strict';

(function() {

class RoutesController {

  constructor($http, $filter, $stateParams, $state, $localStorage, API_BASE_URL) {
    this.$http = $http;
    this.$filter = $filter;
    this.$state = $state;
    this.$localStorage = $localStorage;
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
      if (this.routes && this.routes.plan && this.routes.plan.itineraries) {
        // Store original route itineraries so Angular doesn't mess them up
        this.routes.plan.itineraries.map(function (itinerary) {
          itinerary.originalJson = JSON.stringify(itinerary);
        });
      }
    })
    .catch((err) => {
      this.error = err.data.errorMessage || JSON.stringify(err.data);
    });
  }

  startRoute(itinerary) {
    if (!this.$localStorage.idToken) {
      alert('Please login first');
      return;
    }
    var original = JSON.parse(itinerary.originalJson);
    console.log('Activating route itinerary', original);
    return this.$http.put(this.API_BASE_URL + '/routes/active', original, {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      console.log('Activation response:', response);
      this.$state.go('activeroute');
    })
    .catch((err) => {
      console.log('Activation error:', err);
      this.error = err.data.errorMessage || JSON.stringify(err.data);
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('RoutesController', RoutesController);

})();
