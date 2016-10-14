'use strict';

const expect = require('chai').expect;
const lib = require('../../../auth/lib');


module.exports = function () {

  describe('auth-lib', function () { //eslint-disable-line
    this.timeout(10000);
    const PHONE = '358417556933';
    const TIME_OVERRIDE = 1476444134822;
    const SECRET_OVERRIDE = new Buffer('RB6BmHp8NsAC87JpsxSaB512jXlC9rlncrA+wwi4u/Of7d1b8Rq9/w==', 'base64');
    const KNOWN_CODE1 = '971530';
    const KNOWN_CODE2 = '349066';
    const BAD_CODE = '111111';

    it('should function correctly at the low level', () => {
      let code = lib.__generate_topt_login_code_exec(SECRET_OVERRIDE, 0, TIME_OVERRIDE, 30);
      expect(code).to.equal(KNOWN_CODE1);

      code = lib.generate_topt_login_code(PHONE);
      expect(code).to.not.equal(KNOWN_CODE1);
    });

    it('should produce a valid topt code', () => {
      let code = lib.generate_topt_login_code(PHONE, 0, TIME_OVERRIDE);
      expect(code).to.equal(KNOWN_CODE2);

      code = lib.generate_topt_login_code(PHONE);
      expect(code).to.not.equal(KNOWN_CODE2);
    });

    it('should correctly verify a topt code', () => {
      const code = lib.generate_topt_login_code(PHONE);

      expect(lib.verify_topt_login_code(PHONE, code)).to.be.true;
      expect(lib.verify_topt_login_code(PHONE, BAD_CODE)).to.be.false;
    });

  });
};
