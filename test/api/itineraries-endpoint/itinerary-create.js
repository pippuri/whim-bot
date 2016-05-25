var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var validator = require('../../../lib/validator');
var schema = require('../../../itineraries/itinerary-create/response-schema.json');
var event = require('../../../itineraries/itinerary-create/event.json');

module.exports = function (lambda) {

  describe('create itinerary', () => {
    var error;
    var response;

    before(done => {
      wrap(lambda).run(event, (_error, _response) => {
        error = _error;
        response = _response;
        done();
      });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', () => {
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    }
    );
  });
};
