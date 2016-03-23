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

    this.$http.get(API_BASE_URL + '/auth/me', {
      headers: {
        Authorization: 'Bearer ' + this.$localStorage.idToken
      }
    })
    .then((response) => {
      this.profile = response.data;
    })
    .then(null, (err) => {
      this.error = err.data && err.data.errorMessage || err;
    });
  }
}

angular.module('devMaasGlobalApp')
  .controller('MqttController', MqttController);

})();
