'use strict';

class NavbarController {
  //start-non-standard
  menu = [
    {
      'title': 'Home',
      'state': 'main'
    },
    {
      'title': 'Signup',
      'state': 'signup'
    },
    {
      'title': 'Login',
      'state': 'login'
    },
    {
      'title': 'Profile',
      'state': 'profile'
    },
    {
      'title': 'MQTT',
      'state': 'mqtt'
    }
  ];

  isCollapsed = true;
  //end-non-standard

  constructor() {
  }
}

angular.module('devMaasGlobalApp')
  .controller('NavbarController', NavbarController);
