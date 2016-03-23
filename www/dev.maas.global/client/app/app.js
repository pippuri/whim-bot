'use strict';

angular.module('devMaasGlobalApp', [
  'devMaasGlobalApp.constants',
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ngStorage',
  'ui.router',
  'ui.bootstrap',
  'geolocation',
  'uiGmapgoogle-maps'
])
.config(function($urlRouterProvider, $locationProvider) {
  $urlRouterProvider
    .otherwise('/');

  $locationProvider.html5Mode(true);
})
.value('API_BASE_URL', window.location.hostname == 'prod.maas.global' ? 'https://api.maas.global' : 'https://api.dev.maas.global')
.config(function(uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyAMTPIzTnSl0pTpZgYL7fwGBoiXW9CUxTQ',
        libraries: ''//'weather,geometry,visualization'
    });
});
