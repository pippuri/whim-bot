'use strict';

(function() {

class MainController {

  constructor($http, $filter, $state, $stateParams, $timeout, geolocation) {
    this.$http = $http;
    this.$filter = $filter;
    this.$state = $state;
    this.from = $stateParams.from || '0,0';
    this.to = $stateParams.to || '60.1851607,24.9160174';
    this.fromCoords = this.parseCoords(this.from);
    this.toCoords = this.parseCoords(this.to);
    this.providers = ['tripgo', 'digitransit', 'here', 'hsl', 'matka'];
    this.provider = $stateParams.provider || 'tripgo';
    this.map = {
      center: this.toCoords,
      zoom: 15
    };
    if (!$stateParams.from) {
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
    }

    this.centerChanged = () => {
      this.setTo();
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
