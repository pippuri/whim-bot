'use strict';

angular.module('devMaasGlobalApp')
  .config(function($stateProvider) {
    $stateProvider
      .state('main', {
        url: '/?from&to&provider',
        templateUrl: 'app/main/main.html',
        controller: 'MainController',
        controllerAs: 'main'
      });
  });
