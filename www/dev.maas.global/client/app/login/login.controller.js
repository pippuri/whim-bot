'use strict';

(function() {

class LoginController {

  constructor($http, $stateParams) {
    this.$http = $http;
    this.phone = $stateParams.phone;
    this.code = $stateParams.code;
  }

  login(phone, code) {
    console.log('Logging in as', phone, code);
    this.$http.get('https://api.dev.maas.global/auth/sms-login', {params:{phone:this.phone}})
    .then((response) => {
      console.log('Login response:', response);
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('LoginController', LoginController);

})();
