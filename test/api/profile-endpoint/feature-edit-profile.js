
const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const validator = require('../../../lib/validator');
const schema = require('../../../profile/profile-edit/response-schema.json');
const event = require('../../../profile/profile-edit/event.json');

module.exports = (lambda) => {

  describe('edit an existing user', function () {
    var error;
    var response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should not raise an error', function () {
      if (error) {
        console.warn(error.message);
        console.warn(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should return a valid response', function () {
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
