'use strict';

(function() {

class MainController {

  constructor($http, $filter, $state, $stateParams, $timeout, geolocation) {
    this.$http = $http;
    this.$filter = $filter;
    this.$state = $state;
    this.from = $stateParams.from || '0,0';
    this.to = $stateParams.to || '0,0';
    this.fromCoords = this.parseCoords(this.from);
    this.toCoords = this.parseCoords(this.to);
    this.providers = ['tripgo', 'digitransit', 'here', 'hsl', 'matka'];
    this.provider = $stateParams.provider || 'tripgo';
    this.map = {
      center: this.toCoords,
      zoom: 15
    };
    if (!$stateParams.from || !$stateParams.to) {
      geolocation.getLocation()
      .then((data) => {
        if (!$stateParams.from) {
          this.from = '' + data.coords.latitude + ',' + data.coords.longitude;
          this.fromCoords = {
            latitude: data.coords.latitude,
            longitude: data.coords.longitude
          };
          this.map.center = {
            latitude: data.coords.latitude,
            longitude: data.coords.longitude
          };
        }
        if (!$stateParams.to) {
          this.to = '' + data.coords.latitude + ',' + data.coords.longitude;
          this.toCoords = {
            latitude: data.coords.latitude,
            longitude: data.coords.longitude
          };
        }
      });
    }

    this.centerChanged = (event) => {
      this.setTo(event.center.lat(), event.center.lng());
    }
  }

  parseCoords(str) {
    var coords = str.split(',');
    return {latitude:coords[0], longitude:coords[1]};
  }

  setFrom() {
    this.from = '' + this.map.center.latitude + ',' + this.map.center.longitude;
    this.fromCoords = {
      latitude: this.map.center.latitude,
      longitude: this.map.center.longitude
    };
  }

  setTo(lat, lng) {
    this.to = '' + lat + ',' + lng;
    this.toCoords = {
      latitude: lat,
      longitude: lng
    };
  }

  findRoute(from, to) {
    this.$state.go('routes', {from:from, to:to, provider:this.provider});
  }
}

angular.module('devMaasGlobalApp')
  .controller('MainController', MainController);

})();
