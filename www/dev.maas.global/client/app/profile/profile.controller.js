'use strict';

(function() {

class ProfileController {

  constructor($http, $stateParams, $localStorage, API_BASE_URL) {
    this.$http = $http;
    this.$localStorage = $localStorage;
    this.API_BASE_URL = API_BASE_URL;
    this.idToken = this.$localStorage.idToken;
    this.$http.get(API_BASE_URL + '/auth/me', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      this.profile = response.data;
    })
    .then(null, (err) => {
      this.error = err.data && err.data.errorMessage || err;
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('ProfileController', ProfileController);

})();
