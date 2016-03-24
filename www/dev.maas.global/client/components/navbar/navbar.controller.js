'use strict';

class NavbarController {
  //start-non-standard
  menu = [
    {
      'title': 'Home',
      'state': 'main'
    },
    {
      'title': 'MQTT',
      'state': 'mqtt'
    }
  ];

  isCollapsed = true;
  //end-non-standard

  constructor($localStorage) {
    this.$localStorage = $localStorage;
  }

  isLoggedIn() {
    return !!this.$localStorage.idToken;
  }

  logout() {
    delete this.$localStorage.idToken;
  }
}

angular.module('devMaasGlobalApp')
  .controller('NavbarController', NavbarController);
