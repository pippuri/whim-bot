'use strict';

const expect = require('chai').expect;
const validator = require('../../../lib/validator');
const ValidationError = require('../../../lib/validator/ValidationError');
const schema = require('./test-schema.json');
const cases = require('./test-data.json');
const testErrors = require('./test-errors.json');

describe('validator errors', () => {
  describe('fromValidatorErrors tests', () => {
    it('can be instantiated with multiple errors and object', () => {
      const object = { key: 'value' };
      const error = ValidationError.fromValidatorErrors(testErrors, object);

      expect(error.object).to.equal(object);
      expect(error.errors).to.be.an('array');
    });

    it('can be instantiated with a single error and object', () => {
      const object = { key: 'value' };
      const error = ValidationError.fromValidatorErrors([testErrors[0]], object);

      expect(error.object).to.equal(object);
      expect(error.errors).to.be.an('array');
    });

  });

  describe('fromValue', () => {
    it('can be instantiated with errors and object', () => {
      const object = { key: 'value' };
      const err = testErrors[0];
      const error = ValidationError.fromValue(err.dataPath, err.data, err.message, object);

      expect(error.object).to.equal(object);
      expect(error.errors).to.be.an('array');
      expect(error.errors[0].dataPath).to.equal(err.dataPath);
      expect(error.message).to.be.a('string');
    });
  });
});

describe('validator', () => {
  cases.forEach(test => {
    it(`${test.name}`, () => {
      // Validate the test cases for success & failure
      return validator.validate(schema, test.input, test.options)
        .then(
          validated => ((test.pass) ? Promise.resolve() : Promise.reject(new Error('Should not pass'))),
          error => ((test.pass) ? Promise.reject(new Error('Should not fail')) : Promise.resolve())
        );
    });
  });
});
