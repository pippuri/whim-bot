'use strict';

angular.module('devMaasGlobalApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('monitor', {
        url: '/monitor',
        templateUrl: 'app/monitor/monitor.html',
        controller: 'MonitorController',
        controllerAs: 'monitor'
      });
  });
