'use strict';

(function() {

class ActiveRouteController {

  constructor($scope, $http, $state, $timeout, $localStorage, $geolocation, API_BASE_URL) {
    this.$scope = $scope;
    this.$http = $http;
    this.$state = $state;
    this.$timeout = $timeout;
    this.$localStorage = $localStorage;
    this.$geolocation = $geolocation;
    this.currentCoords = {};
    this.API_BASE_URL = API_BASE_URL;
    this.itinerary = null;
    this.currentLeg = null;
    this.nextLeg = null;
    this.messageLog = [];
    this.locationUpdateCount = 0;
    this.lastUpdatedLatitude = 0;
    this.lastUpdatedLongitude = 0;
    this.options = {
      regionName: 'eu-west-1',
      topicFilter: '',
      accessKey: '', // fill in later
      secretKey: '', // fill in later
      endpoint: '', // fill in later
      clientId: null // fill in later
    };

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
      this.currentCoords = {
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
        console.log('New position:', newValue);
        if (this.map.tracking) {
          this.map.center = {
            latitude: newValue.latitude,
            longitude: newValue.longitude
          };
        }
        this.currentCoords = {
          latitude: newValue.latitude,
          longitude: newValue.longitude
        };
        if (this.client && this.connected && this.shadowUpdateTopic) {
          this.updateThingShadowLocation(newValue.latitude, newValue.longitude);
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
      this.startMqtt();
    })
    .catch((err) => {
      this.error = err.data && err.data.errorMessage || JSON.stringify(err);
    });

    $scope.$on('$destroy', () => {
      console.log('DESTROY');
      if (this.client && this.connected) {
        var client = this.client;
        this.client = null;
        client.disconnect();
      }
    });
  }

  updateThingShadowLocation(latitude, longitude) {
    // Publish location to Thing Shadow
    if (!(latitude != this.lastUpdatedLatitude || longitude != this.lastUpdatedLongitude)) {
      // No change
      return;
    }
    this.lastUpdatedLatitude = latitude;
    this.lastUpdatedLongitude = longitude;
    var msg = JSON.stringify({
      state: {
        reported: {
          location: {
            lat: latitude,
            lon: longitude
          }
        }
      }
    });
    var message = new Messaging.Message(msg);
    message.destinationName = this.shadowUpdateTopic;
    console.log('Updating thing shadow:', this.shadowUpdateTopic, msg);
    this.client.send(message);
    this.locationUpdateCount += 1;
    this.info = {
      time: Date.now(),
      text: 'ThingShadow[' + this.locationUpdateCount + '] ' + latitude + ',' + longitude
    };
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
    .catch((err) => {
      this.error = err.data && err.data.errorMessage || JSON.stringify(err);
    });
  }

  startMqtt() {
    this.$http.get(this.API_BASE_URL + '/auth/mqtt', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      console.log('MQTT auth response:', response);
      var cleanId = response.data.IdentityId.replace(/:/g, '-');
      this.identityId = response.data.IdentityId;
      this.thingName = response.data.ThingName || cleanId;
      this.locationTopic = 'maas/id/' + response.data.IdentityId + '/location';
      this.shadowUpdateTopic = '$aws/things/' + this.thingName + '/shadow/update';
      this.options.endpoint = response.data.IotEndpoint;
      this.options.clientId = 'maas-client-' + response.data.IdentityId + '-' + Date.now();
      this.options.topicFilter = 'maas/id/' + response.data.IdentityId + '/#';
      this.options.accessKey = response.data.Credentials.AccessKeyId;
      this.options.secretKey = response.data.Credentials.SecretKey;
      this.options.sessionToken = response.data.Credentials.SessionToken;
      console.log('Opening MQTT client connection as', this.options);
      this.messageLog.push({msg:'Connecting to MQTT service...'});
      this.client = new Messaging.Client(this.options.endpoint, 443, this.options.clientId);
      this.client.onConnectionLost = this.onConnectionLost.bind(this);
      this.client.onMessageArrived = this.onMessageArrived.bind(this);
      this.client.connect({onSuccess:this.onConnect.bind(this), onFailure:this.onFailure.bind(this), useSSL:true, path:SigV4Utils.signedMqttPath(this.options)});
    })
    .catch((err) => {
      this.error = err.data && err.data.errorMessage || err;
    });
  }

  onConnect() {
    this.messageLog.push({msg:'Connected to MQTT service.'});
    console.log('CONNECTED');
    console.log('Subscribing to topic', this.options.topicFilter);
    this.messageLog.push({msg:'Subscribing to topic ' + this.options.topicFilter});
    this.connected = true;
    this.client.subscribe(this.options.topicFilter);
    this.updateThingShadowLocation(this.$geolocation.position.coords.latitude, this.$geolocation.position.coords.longitude);
    this.$scope.$apply();
  }

  onFailure(err) {
    console.log('CONNECT FAILURE', err);
    this.messageLog.push({msg:'Connection to MQTT service failed: ' + err});
    this.$scope.$apply();
  }

  onConnectionLost(responseObject) {
    console.log('DISCONNECTED');
    if (!this.client) return;
    this.connected = false;
    this.messageLog.push({msg:'Disconnected from MQTT service.'});
    var self = this;
    if (responseObject.errorCode !== 0) {
      // Reconnect after a delay
      console.log('Got MQTT error', responseObject.errorCode, 'reconnecting in 10 seconds');
      this.$timeout(function () {
        self.client.connect({onSuccess:self.onConnect.bind(self), useSSL:true, path:SigV4Utils.signedMqttPath(self.options)});
      }, 10000);
    } else {
      // Reconnect immediately
      self.client.connect({onSuccess:self.onConnect.bind(self), useSSL:true, path:SigV4Utils.signedMqttPath(self.options)});
    }
    this.$scope.$apply();
  }

  onMessageArrived(message) {
    console.log("onMessageArrived:", message.destinationName, message.payloadString);
    this.messageLog.push({msg:'[' + message.destinationName + '] ' + message.payloadString});
    this.$scope.$apply();
  }
}

angular.module('devMaasGlobalApp')
  .controller('ActiveRouteController', ActiveRouteController);

})();
