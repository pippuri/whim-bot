'use strict';

(function() {

class MainController {

  constructor($http) {
    this.$http = $http;
    this.from = '60.185034,24.9147957';
    this.to = '60.1883726,24.9574861';
    this.routes = null;
    this.segmentTemplates = {};
  }

  findRoute(from, to) {
    this.$http.get('https://api.dev.maas.global/routes/find?from=(' + from + ')&to=' + to)
    .then((response) => {
      this.routes = response.data;
      this.routes.segmentTemplates.map((template) => {
        this.segmentTemplates[template.hashCode] = template;
      });
    });
  }

  expandSegmentTemplate(segment) {
    var template = this.segmentTemplates[segment.segmentTemplateHashCode];
    var duration = segment.endTime - segment.startTime;
    var durationMinutes = ' (' + Math.floor(duration / 60) + ' min) ';
    var text = template.action
    .replace(/<DURATION>/g, durationMinutes)
    .replace(/<NUMBER>/g, segment.serviceNumber);
    if (template.from && template.from.address) {
      text += ' from ' + template.from.address;
    }
    if (template.to && template.to.address) {
      text += ' to ' + template.to.address;
    }
    return text;
  }
}

angular.module('devMaasGlobalApp')
  .controller('MainController', MainController);

})();
