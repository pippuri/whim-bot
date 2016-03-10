'use strict';

(function() {

class LoginController {

  constructor($http, $location) {
    this.$http = $http;
    this.phone = $location.search().phone;
    this.code = $location.search().code;
  }

  login(phone, code) {
    console.log('Logging in as', phone, code);
  }
}

angular.module('devMaasGlobalApp')
  .controller('LoginController', LoginController);

})();
