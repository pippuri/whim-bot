'use strict';

(function() {

class MqttController {

  constructor($http, $localStorage, $timeout, API_BASE_URL) {
    this.$http = $http;
    this.$localStorage = $localStorage;
    this.$timeout = $timeout;
    this.API_BASE_URL = API_BASE_URL;

    this.options = {
      regionName: 'eu-west-1',
      topicFilter: '',
      accessKey: '', // fill in later
      secretKey: '', // fill in later
      endpoint: 'a3lehuix0sl1ku.iot.eu-west-1.amazonaws.com',
      clientId: null // fill in later
    };

    this.$http.get(API_BASE_URL + '/auth/mqtt', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      this.options.clientId = 'maas-client-' + response.data.IdentityId + '-' + Date.now();
      this.options.topicFilter = 'maas/id/' + response.data.IdentityId + '/#';
      this.options.accessKey = response.data.Credentials.AccessKeyId;
      this.options.secretKey = response.data.Credentials.SecretKey;
      this.options.sessionToken = response.data.Credentials.SessionToken;
      console.log('Opening MQTT client connection as', this.options);
      this.client = new Messaging.Client(this.options.endpoint, 443, this.options.clientId);
      this.client.onConnectionLost = this.onConnectionLost.bind(this);
      this.client.onMessageArrived = this.onMessageArrived.bind(this);
      this.client.connect({onSuccess:this.onConnect.bind(this), useSSL:true, path:SigV4Utils.signedMqttPath(this.options)});
    })
    .then(null, (err) => {
      this.error = err.data && err.data.errorMessage || err;
    });
  }

  onConnect() {
    this.connected = true;
    console.log('Subscribing to topic', this.options.topicFilter);
    this.client.subscribe(this.options.topicFilter);
  }

  onConnectionLost(responseObject) {
    this.connected = false;
    if (!this.client) return;
    var self = this;
    if (responseObject.errorCode !== 0) {
      // Reconnect after a delay
      $timeout(function () {
        client.connect({onSuccess:self.onConnect.bind(self), useSSL:true, path:SigV4Utils.signedMqttPath(self.options)});
      }, 10000);
    } else {
      // Reconnect immediately
      client.connect({onSuccess:self.onConnect.bind(self), useSSL:true, path:SigV4Utils.signedMqttPath(self.options)});
    }
  }

  onMessageArrived(message) {
    var payload = JSON.parse(message.payloadString);
    console.log("onMessageArrived:", message.destinationName, payload);
  }
}

angular.module('devMaasGlobalApp')
  .controller('MqttController', MqttController);

})();
