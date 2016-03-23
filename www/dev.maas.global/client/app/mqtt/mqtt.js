'use strict';

angular.module('devMaasGlobalApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('mqtt', {
        url: '/mqtt',
        templateUrl: 'app/mqtt/mqtt.html',
        controller: 'MqttController',
        controllerAs: 'mqtt'
      });
  });
