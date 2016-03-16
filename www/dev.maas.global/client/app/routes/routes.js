'use strict';

angular.module('devMaasGlobalApp')
  .config(function($stateProvider) {
    $stateProvider
      .state('routes', {
        url: '/routes?from&to&provider',
        templateUrl: 'app/routes/routes.html',
        controller: 'RoutesController',
        controllerAs: 'routes'
      });
  });
