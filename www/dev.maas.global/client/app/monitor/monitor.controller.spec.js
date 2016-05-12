'use strict';

describe('Component: MonitorComponent', function () {

  // load the controller's module
  beforeEach(module('devMaasGlobalApp'));

  var MonitorComponent, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($componentController, $rootScope) {
    scope = $rootScope.$new();
    MonitorComponent = $componentController('MonitorComponent', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).to.equal(1);
  });
});
