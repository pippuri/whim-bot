'use strict';

(function() {

class LoginController {

  constructor($http, $stateParams, API_BASE_URL) {
    this.$http = $http;
    this.phone = $stateParams.phone;
    this.code = $stateParams.code;
    this.API_BASE_URL = API_BASE_URL;
  }

  login(phone, code) {
    console.log('Logging in as', phone, code);
    this.$http.get(this.API_BASE_URL + '/auth/sms-login', {params:{phone:this.phone, code:this.code}})
    .then((response) => {
      console.log('Login response:', response);
      this.token = response.data;
    })
    .then(null, (err) => {
      this.error = err.data.errorMessage || JSON.stringify(err.data);
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('LoginController', LoginController);

})();
