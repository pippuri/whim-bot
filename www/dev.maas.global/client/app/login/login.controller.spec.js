'use strict';

describe('Controller: LoginController', function() {

  // load the controller's module
  beforeEach(module('devMaasGlobalApp'));
  beforeEach(module('stateMock'));

  var scope;
  var LoginController;
  var state;
  var $httpBackend;

  // Initialize the controller and a mock scope
  beforeEach(inject(function(_$httpBackend_, $controller, $rootScope, $state) {
    $httpBackend = _$httpBackend_;
    $httpBackend.expectGET('/api/things')
      .respond(['HTML5 Boilerplate', 'AngularJS', 'Karma', 'Express']);

    scope = $rootScope.$new();
    state = $state;
    LoginController = $controller('LoginController', {
      $scope: scope
    });
  }));

  it('should attach a list of things to the controller', function() {
    $httpBackend.flush();
    expect(LoginController.awesomeThings.length).to.equal(4);
  });
});
