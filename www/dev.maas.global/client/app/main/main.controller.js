'use strict';

(function() {

class MainController {

  constructor($http, $filter, $state, $stateParams, $timeout, $geolocation, API_BASE_URL) {
    this.$http = $http;
    this.$filter = $filter;
    this.$state = $state;
    this.from = $stateParams.from || '0,0';
    this.to = $stateParams.to || '0,0';
    this.fromCoords = this.parseCoords(this.from);
    this.toCoords = this.parseCoords(this.to);
    // this.from = null;
    // this.to = null;
    // this.fromCoords = null;
    // this.toCoords = null;
    this.API_BASE_URL = API_BASE_URL;
    this.locations = {};
    this.providers = ['tripgo', 'digitransit', 'here', 'hsl', 'matka'];
    this.provider = $stateParams.provider || 'tripgo';
    this.map = {
      center: this.toCoords,
      zoom: 15
    };
    if (!$stateParams.from || !$stateParams.to) {
      $geolocation.getCurrentPosition()
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

  getLocations(val) {
    console.log('getLocations');
    this.directUrl = this.API_BASE_URL + '/locations/query?name=' + val;
    return this.$http.get(this.directUrl)
      .then((response) => {
        console.log(response);

        // Parse names to simple array
        if(typeof response.data.locations !== 'undefined') {
          return response.data.locations.map((location) => {
            this.locations[location.name] = {
              lat: location.lat,
              lon: location.lon
            };

            return location.name;
          });
        } else {
          return this.locations = {};
        }
      })
      .then(null, (err) => {
        console.log('Error:', err);
        this.error = err.data.errorMessage || JSON.stringify(err.data);
      })
  }

  findRoute(from, to) {

    // If is specified in locations (typeahead populated), get coords from there
    if(typeof this.locations[from] !== 'undefined') {
      from = this.locations[from].lat + "," + this.locations[from].lon;
    }

    if(typeof this.locations[to] !== 'undefined') {
      to = this.locations[to].lat + "," + this.locations[to].lon;
    }

    this.$state.go('routes', {from:from, to:to, provider:this.provider});
  }
}

angular.module('devMaasGlobalApp')
  .controller('MainController', MainController);

})();
