'use strict';

(function() {

class ActiveRouteController {

  constructor($http, $state, $localStorage, API_BASE_URL) {
    this.$http = $http;
    this.$state = $state;
    this.$localStorage = $localStorage;
    this.API_BASE_URL = API_BASE_URL;
    this.itinerary = null;
    this.currentLeg = null;
    this.nextLeg = null;

    this.$http.get(this.API_BASE_URL + '/routes/active', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      console.log('Currently active route:', response.data);
      this.itinerary = response.data;
      this.updateLegs();
    })
    .then(null, (err) => {
      this.error = err.data && err.data.errorMessage || JSON.stringify(err);
    });
  }

  updateLegs() {
    if (!this.itinerary || !this.itinerary.legs) {
      this.currentLeg = null;
      this.nextLeg = null;
    }
    var now = Date.now();
    this.itinerary.legs.map((leg) => {
      if (!this.currentLeg & leg.startTime <= now && now < leg.endTime) {
        this.currentLeg = leg;
      }
      if (!this.nextLeg & leg.startTime >= now) {
        this.nextLeg = leg;
      }
    });
  }

  destroyActiveRoute() {
    this.$http.delete(this.API_BASE_URL + '/routes/active', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      this.$state.go('main');
    })
    .then(null, (err) => {
      this.error = err.data && err.data.errorMessage || JSON.stringify(err);
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('ActiveRouteController', ActiveRouteController);

})();
