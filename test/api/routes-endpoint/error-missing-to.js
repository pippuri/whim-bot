
const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment');

module.exports = (lambda) => {

  describe('request without "to"', function () {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000', // test user
      from: '60.1684126,24.9316739', // SC5 Office
      leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
    };

    var error;
    var response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should raise an error', function () {
      expect(error).not.to.be.null;
    });

    it('should provide the expected error message', function () {
      expect(error.message).to.equal('Missing "to" argument.');
    });

    it('should not return a response', function () {
      expect(response).to.be.undefined;
    });

  });
};
