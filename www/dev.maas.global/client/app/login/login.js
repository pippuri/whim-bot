'use strict';

angular.module('devMaasGlobalApp')
  .config(function($stateProvider) {
    $stateProvider
      .state('login', {
        url: '/login?phone&code',
        templateUrl: 'app/login/login.html',
        controller: 'LoginController',
        controllerAs: 'login'
      });
  });
