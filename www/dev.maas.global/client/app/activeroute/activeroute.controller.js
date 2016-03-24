'use strict';

(function() {

class ActiveRouteController {

  constructor($scope, $http, $state, $localStorage, $geolocation, API_BASE_URL) {
    this.$scope = $scope;
    this.$http = $http;
    this.$state = $state;
    this.$localStorage = $localStorage;
    this.$geolocation = $geolocation;
    this.API_BASE_URL = API_BASE_URL;
    this.itinerary = null;
    this.currentLeg = null;
    this.nextLeg = null;

    this.map = {
      center: {latitude:0, longitude:0},
      zoom: 15,
      tracking: true
    };
    $geolocation.getCurrentPosition()
    .then((data) => {
      this.map.center = {
        latitude: data.coords.latitude,
        longitude: data.coords.longitude
      };
    });
    $geolocation.watchPosition({
      enableHighAccuracy: true
    });

    $scope.$geolocation = $geolocation;
    $scope.map = this.map;
    $scope.$watch('$geolocation.position.coords', (newValue, oldValue) => {
      if (newValue) {
        console.log('Position:', newValue);
        if (this.map.tracking) {
          this.map.center = {
            latitude: newValue.latitude,
            longitude: newValue.longitude
          };
        }
      }
    });
    $scope.$watch('map.tracking', (newValue, oldValue) => {
      if (newValue && $geolocation.position.coords) {
        this.map.center = {
          latitude: $geolocation.position.coords.latitude,
          longitude: $geolocation.position.coords.longitude
        };
      }
    });

    this.$http.get(this.API_BASE_URL + '/routes/active', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      console.log('Currently active route:', response.data);
      this.itinerary = response.data;
      this.itinerary.legs.map((leg) => {
        leg.fromCoords = leg.from ? {
          latitude: leg.from.lat,
          longitude: leg.from.lon
        } : {};
        leg.toCoords = leg.to ? {
          latitude: leg.to.lat,
          longitude: leg.to.lon
        } : {};
        leg.decodedPath = this.decodePath(leg.legGeometry);
      });
      this.updateLegs();
    })
    .then(null, (err) => {
      this.error = err.data && err.data.errorMessage || JSON.stringify(err);
    });
  }

  decodePath(legGeometry) {
    if (!legGeometry) return null;
    var points = google.maps.geometry.encoding.decodePath(legGeometry.points);
    return points;
  }

  updateLegs() {
    if (!this.itinerary || !this.itinerary.legs) {
      this.currentLeg = null;
      this.nextLeg = null;
    }
    var now = Date.now();
    this.itinerary.legs.map((leg) => {
      if (!this.currentLeg & leg.startTime <= now && now < leg.endTime) {
        this.currentLeg = leg;
      }
      if (!this.nextLeg & leg.startTime >= now) {
        this.nextLeg = leg;
      }
    });
  }

  destroyActiveRoute() {
    this.$http.delete(this.API_BASE_URL + '/routes/active', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      this.$state.go('main');
    })
    .then(null, (err) => {
      this.error = err.data && err.data.errorMessage || JSON.stringify(err);
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('ActiveRouteController', ActiveRouteController);

})();
