
const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment');

module.exports = function (lambda) {

  describe('request with both "leaveAt" and "arriveBy"', function () {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000', // test user
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
      arriveBy: '' + moment().isoWeekday(8).hour(21).valueOf(), // Monday one week forward around nine
    };

    var error;
    var response;

    before(function (done) {
      wrap(lambda).run(event, function (err, data) {
        error = err;
        response = data;
        done();
      });
    });

    it('should raise an error', function () {
      expect(error).not.to.be.null;
    });

    it('should provide the expected error message', function () {
      expect(error.message).to.equal('Both "leaveAt" and "arriveBy" provided.');
    });

    it('should not return a response', function () {
      expect(response).to.be.undefined;
    });

  });
};
