'use strict';

const path = require('path');
const expect = require('chai').expect;
const dereferencer = require('maas-schemas/dereferencer');
const validator = require('../../../lib/validator');

const unreferenced = require('../../../www/apidocs.maas.global/api/maas-api.json');
const swaggerSchema = require('swagger-schema-official/schema.json');
const docPath = path.resolve('www/apidocs.maas.global/api');
const swaggerFile = path.resolve(docPath, 'maas-api.json');

describe('API documentation', function () {
  this.timeout(20000);

  let dereferencingError;
  let validationError;

  before(() => {
    return dereferencer.dereference(swaggerFile)
      .then(
        dereferenced => validator.validate(swaggerSchema, unreferenced),
        error => (dereferencingError = error)
      )
      .catch(error => (validationError = error));
  });

  it('dereferences all $refs from Swagger definition', () => {
    expect(dereferencingError).to.be.undefined;
  });

  xit('TODO validates against Swagger schema', () => {
    // TODO Add missing response definitions and correct the faulty ones
    expect(validationError).to.be.undefined;
  });

  xit('TODO catches the known Swagger UI problems', () => {
    // TODO Implement test, e.g. find missing 'type' definitions
  });
});
