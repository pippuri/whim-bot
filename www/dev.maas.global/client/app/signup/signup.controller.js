'use strict';

(function() {

class SignupController {

  constructor($http, $stateParams, $state) {
    this.$http = $http;
    this.$state = $state;
    this.phone = $stateParams.phone;
  }

  signup(phone) {
    console.log('Signing up as', phone);
    this.$http.get('https://api.dev.maas.global/auth/sms-request-code', {params:{phone:phone}})
    .then((response) => {
      // Go to sign up view
      this.$state.go('login', {phone:this.phone});
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('SignupController', SignupController);

})();
