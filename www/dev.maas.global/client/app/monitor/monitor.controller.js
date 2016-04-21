'use strict';

(function(){

class MonitorController {
  constructor($http, $interval, API_BASE_URL) {
    this.$http = $http;
    this.$interval = $interval;
    this.API_BASE_URL = API_BASE_URL;
    this.users = {};
    this.userMarkers = [];
    this.map = {
      center: {
        latitude: 60.30,
        longitude: 24.90
      },
      zoom: 11,
      markerEvents: {
        click: (event, eventName, model) => {
          console.log('Click', model);
          if (this.soloUser) {
            this.soloUser = null;
          } else {
            this.soloUser = model.id;
          }
          this.updateMarkers();
        }
      }
    };
    this.soloUser = null;
    this.refreshState();
    $interval(this.refreshState.bind(this), 30000);
  }

  findLeg(legs, legId) {
    var foundLeg;
    legs.map(leg => {
      if (leg.legId == legId) {
        foundLeg = leg;
      }
    });
    return foundLeg;
  }

  generateGeometry(user, allLegs) {
    // Generate route geometry
    user.polyline.length = 0;
    if (allLegs) {
      // Show all legs of solo user
      if (user.activeRoute && user.activeRoute.legs) {
        user.activeRoute.legs.map(leg => {
          if (leg.from && leg.from.lat && leg.from.lon) {
            user.polyline.push({
              latitude: leg.from.lat,
              longitude: leg.from.lon
            });
          }
        });
        var lastLeg = user.activeRoute.legs[user.activeRoute.legs.length-1];
        if (lastLeg && lastLeg.to && lastLeg.to.lat && lastLeg.to.lon) {
          user.polyline.push({
            latitude: lastLeg.to.lat,
            longitude: lastLeg.to.lon
          });
        }
      }
    } else {
      // Show active leg only
      if (user.activeLeg && user.activeLeg.from && user.activeLeg.from.lat && user.activeLeg.to && user.activeLeg.to.lat) {
        user.polyline.push(
          {latitude:user.activeLeg.from.lat, longitude:user.activeLeg.from.lon}
        );
        user.polyline.push(
          {latitude:user.activeLeg.to.lat, longitude:user.activeLeg.to.lon}
        );
      }
    }
  }

  updateMarkers() {
    var userMarkers = [];
    Object.keys(this.users).map(key => {
      var user = this.users[key];
      if (!this.soloUser || this.soloUser == key) {
        this.generateGeometry(user, !!this.soloUser);
        userMarkers.push(user);
      }
    });
    this.userMarkers = userMarkers;
  }

  refreshState() {
    // Load current state
    this.$http.get(this.API_BASE_URL + '/monitor')
    .then(response => {
      Object.keys(response.data).map(key => {
        var user = response.data[key]
        user.activeRoute = user.state.activeRoute;
        user.activeLeg = null;
        if (user.activeRoute) {
          user.activeLeg = this.findLeg(user.activeRoute.legs, user.activeRoute.activeLeg.legId);
        }
        this.users[key] = user;
        user.id = key;
        if (user.activeLeg) {
          user.options = {
            labelContent: '' + user.phone + ' ' + (user.activeLeg.mode || '') + '<br>' + (user.activeLeg.routeLongName || user.activeLeg.routeShortName || ''),
            labelClass: 'user-marker'
          };
        } else {
          user.options = {};
        }
        if (user.state.location && user.state.location.lat && user.state.location.lon) {
          user.coords = {
            latitude: user.state.location.lat,
            longitude: user.state.location.lon
          };
        }
        user.stroke = {weight:1};
        user.polyline = [];
      });
      this.updateMarkers();
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('MonitorController', MonitorController);

})();
