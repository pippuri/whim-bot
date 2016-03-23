'use strict';

(function() {

class SignupController {

  constructor($http, $stateParams, $state, API_BASE_URL) {
    this.$http = $http;
    this.$state = $state;
    this.phone = $stateParams.phone;
    this.API_BASE_URL = API_BASE_URL;
  }

  signup(phone) {
    console.log('Signing up as', phone);
    this.$http.get(this.API_BASE_URL + '/auth/sms-request-code', {params:{phone:phone}})
    .then((response) => {
      // Go to sign up view
      this.$state.go('login', {phone:this.phone});
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('SignupController', SignupController);

})();
