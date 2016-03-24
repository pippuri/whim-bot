'use strict';

angular.module('devMaasGlobalApp')
  .config(function($stateProvider) {
    $stateProvider
      .state('activeroute', {
        url: '/activeroute',
        templateUrl: 'app/activeroute/activeroute.html',
        controller: 'ActiveRouteController',
        controllerAs: 'activeroute'
      });
  });
