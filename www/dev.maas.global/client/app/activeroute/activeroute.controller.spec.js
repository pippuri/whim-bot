'use strict';

describe('Controller: RoutesController', function() {

  // load the controller's module
  beforeEach(module('devMaasGlobalApp'));
  beforeEach(module('stateMock'));

  var scope;
  var RoutesController;
  var state;
  var $httpBackend;

  // Initialize the controller and a mock scope
  beforeEach(inject(function(_$httpBackend_, $controller, $rootScope, $state) {
    $httpBackend = _$httpBackend_;
    $httpBackend.expectGET('/api/things')
      .respond(['HTML5 Boilerplate', 'AngularJS', 'Karma', 'Express']);

    scope = $rootScope.$new();
    state = $state;
    RoutesController = $controller('RoutesController', {
      $scope: scope
    });
  }));

  it('should attach a list of things to the controller', function() {
    $httpBackend.flush();
    expect(RoutesController.awesomeThings.length).to.equal(4);
  });
});
