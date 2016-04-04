'use strict';

(function() {

class MqttController {

  constructor($scope, $http, $localStorage, $timeout, API_BASE_URL) {
    this.$scope = $scope;
    this.$http = $http;
    this.$localStorage = $localStorage;
    this.$timeout = $timeout;
    this.API_BASE_URL = API_BASE_URL;
    this.messageLog = [];

    this.options = {
      regionName: 'eu-west-1',
      topicFilter: '',
      accessKey: '', // fill in later
      secretKey: '', // fill in later
      endpoint: '', // fill in later
      clientId: null // fill in later
    };

    this.$http.get(API_BASE_URL + '/auth/mqtt', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      var cleanId = response.data.IdentityId.replace(/:/g, '-');
      this.options.endpoint = response.data.IotEndpoint;
      this.options.clientId = 'maas-client-' + response.data.IdentityId + '-m' + Date.now();
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

    $scope.$on('$destroy', () => {
      console.log('DESTROY');
      if (this.client && this.connected) {
        var client = this.client;
        this.client = null;
        client.disconnect();
      }
    });
  }

  onConnect() {
    this.messageLog.push({msg:'Connected to MQTT service.'});
    console.log('CONNECTED');
    console.log('Subscribing to topic', this.options.topicFilter);
    this.messageLog.push({msg:'Subscribing to topic ' + this.options.topicFilter});
    this.connected = true;
    this.client.subscribe(this.options.topicFilter);
    this.$scope.$apply();
  }

  onFailure(err) {
    console.log('CONNECT FAILURE', err);
    this.messageLog.push({msg:'Connection to MQTT service failed: ' + err});
    this.$scope.$apply();
  }

  onConnectionLost(responseObject) {
    console.log('DISCONNECTED');
    this.messageLog.push({msg:'Disconnected from MQTT service.'});
    this.connected = false;
    if (!this.client) return;
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
  .controller('MqttController', MqttController);

})();
