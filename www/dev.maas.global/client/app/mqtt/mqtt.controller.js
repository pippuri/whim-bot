'use strict';

(function() {

class MqttController {

  constructor($http, $localStorage, API_BASE_URL) {
    this.$http = $http;
    this.$localStorage = $localStorage;
    this.API_BASE_URL = API_BASE_URL;
    this.idToken = this.$localStorage.idToken;

    var options = {
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

      options.clientId = 'maas-client-' + response.data.IdentityId + '-' + Date.now();
      options.topicFilter = 'maas/id/' + response.data.IdentityId + '/#';
      options.accessKey = response.data.Credentials.AccessKeyId;
      options.secretKey = response.data.Credentials.SecretKey;
      options.sessionToken = response.data.Credentials.SessionToken;
      console.log('Opening MQTT client connection as', options);
      this.client = new Messaging.Client(options.endpoint, 443, options.clientId);
      client.onConnectionLost = onConnectionLost;
      client.onMessageArrived = onMessageArrived;
      client.connect({onSuccess:onConnect, useSSL:true, path:SigV4Utils.signedMqttPath(options)});

      function onConnect() {
        connected = true;
        console.log('Subscribing to topic', options.topicFilter);
        $rootScope.$broadcast('maassocket-open', {});
        client.subscribe(options.topicFilter);
        //client.subscribe('/randomchat');
      }

      function onConnectionLost(responseObject) {
        connected = false;
        $rootScope.$broadcast('maassocket-close', responseObject)
        if (!client) return;
        if (responseObject.errorCode !== 0) {
          // Reconnect after a delay
          $timeout(function () {
            client.connect({onSuccess:onConnect, useSSL:true, path:SigV4Utils.signedMqttPath(options)});
          }, 10000);
        } else {
          // Reconnect immediately
          client.connect({onSuccess:onConnect, useSSL:true, path:SigV4Utils.signedMqttPath(options)});
        }
      }

      function onMessageArrived(message) {
        //console.log("onMessageArrived:", message.destinationName);
        $rootScope.$broadcast('maassocket-message', {
          topic: message.destinationName,
          payload: JSON.parse(message.payloadString)
        });
      }

    })
    .then(null, (err) => {
      this.error = err.data && err.data.errorMessage || err;
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('MqttController', MqttController);

})();
