'use strict';

angular.module('devMaasGlobalApp', [
  'devMaasGlobalApp.constants',
  'ngCookies',
  'ngResource',
  'ngSanitize',
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
.config(function(uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyAMTPIzTnSl0pTpZgYL7fwGBoiXW9CUxTQ',
        libraries: ''//'weather,geometry,visualization'
    });
});
