'use strict';

const utils = require('../../../lib/utils');
const expect = require('chai').expect;

describe('removeNulls', () => {
  it('should return plain value as-is', () => {
    const value = 'foobar';
    expect(utils.removeNulls(value)).to.equal('foobar');
  });

  it('should not touch root-level null', () => {
    const value = null;
    expect(utils.removeNulls(value)).to.equal(null);
  });

  it('should return null values recursively', () => {
    const value = {
      simpleValue: 'simple',
      nullValue: null,
      nestedObject: {
        simpleValue: 123,
        nullValue: null,
        nestedObject: {
          simpleValue: 234,
          nullValue: null,
        },
      },
    };

    expect(utils.removeNulls(value)).to.deep.equal({
      simpleValue: 'simple',
      nestedObject: {
        simpleValue: 123,
        nestedObject: {
          simpleValue: 234,
        },
      },
    });
  });

  it('should parse the nested objects inside arrays, but leave nulls alone', () => {
    const value = {
      arrayValue: [null, 'simple', { simpleValue: 123, nullValue: null }],
    };

    expect(utils.removeNulls(value)).to.deep.equal({
      arrayValue: [null, 'simple', { simpleValue: 123 }],
    });
  });
});
