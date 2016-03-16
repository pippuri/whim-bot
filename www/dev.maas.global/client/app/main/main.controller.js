'use strict';

(function() {

class MainController {

  constructor($http, $filter, $state, geolocation) {
    this.$http = $http;
    this.$filter = $filter;
    this.$state = $state;
    this.from = '0,0';
    this.fromCoords = {latitude: 0, longitude: 0};
    this.to = '60.1851607,24.9160174';
    this.toCoords = {latitude:60.1851607, longitude:24.9160174};
    this.providers = ['tripgo', 'digitransit', 'here', 'hsl', 'matka'];
    this.provider = 'tripgo';
    this.map = {
      center: {
        latitude: 0,
        longitude: 0
      },
      zoom: 15
    };
    geolocation.getLocation()
    .then((data) => {
      this.from = '' + data.coords.latitude + ',' + data.coords.longitude;
      this.fromCoords = {
        latitude: data.coords.latitude,
        longitude: data.coords.longitude
      };
      this.map.center = {
        latitude: data.coords.latitude,
        longitude: data.coords.longitude
      };
    });

    this.centerChanged = () => {
      this.setTo();
    }
  }
  
  setFrom() {
    this.from = '' + this.map.center.latitude + ',' + this.map.center.longitude;
    this.fromCoords = {
      latitude: this.map.center.latitude,
      longitude: this.map.center.longitude
    };
  }

  setTo() {
    this.to = '' + this.map.center.latitude + ',' + this.map.center.longitude;
    this.toCoords = {
      latitude: this.map.center.latitude,
      longitude: this.map.center.longitude
    };
  }


  findRoute(from, to) {
    this.$state.go('routes', {from:from, to:to, provider:this.provider});
  }
}

angular.module('devMaasGlobalApp')
  .controller('MainController', MainController);

})();
