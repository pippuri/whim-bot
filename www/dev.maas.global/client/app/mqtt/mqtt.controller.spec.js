'use strict';

describe('Component: MqttComponent', function () {

  // load the controller's module
  beforeEach(module('devMaasGlobalApp'));

  var MqttComponent, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($componentController, $rootScope) {
    scope = $rootScope.$new();
    MqttComponent = $componentController('MqttComponent', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).to.equal(1);
  });
});
