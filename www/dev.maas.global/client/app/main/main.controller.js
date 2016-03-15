'use strict';

(function() {

class MainController {

  constructor($http, $filter) {
    this.$http = $http;
    this.$filter = $filter;
    this.from = '60.185034,24.9147957';
    this.to = '60.1883726,24.9574861';
    this.providers = ['tripgo', 'digitransit', 'here', 'hsl', 'matka'];
    this.provider = 'tripgo';
    this.routes = null;
    this.segmentTemplates = {};
    this.directUrl = '';
  }

  findRoute(from, to) {
    this.directUrl = 'https://api.dev.maas.global/routes?from=' + from + '&to=' + to + '&provider=' + this.provider;
    this.$http.get(this.directUrl)
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
    var time = this.$filter('date')(segment.startTime*1000, 'HH:mm');
    var text = template.action
    .replace(/<DURATION>/g, durationMinutes)
    .replace(/<NUMBER>/g, segment.serviceNumber)
    .replace(/<TIME>/g, time);
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
