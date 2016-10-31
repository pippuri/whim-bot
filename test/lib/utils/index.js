'use strict';

const utils = require('../../../lib/utils');
const expect = require('chai').expect;

describe('utils', () => {
  describe('merge', () => {
    it('merges strings and undefines properly', () => {
      expect(utils.merge(undefined, '12345')).to.equal('12345');
      expect(utils.merge('12345', undefined)).to.equal('12345');
    });

    it('merges strings and numbers properly', () => {
      expect(utils.merge(123, '12345')).to.equal('12345');
      expect(utils.merge('12345', 1234)).to.equal(1234);
    });

    it('merges numbers and booleans properly', () => {
      expect(utils.merge(123, true)).to.equal(true);
      expect(utils.merge(true, 1234)).to.equal(1234);
    });

    it('merges other types and nulls properly', () => {
      expect(utils.merge(123, null)).to.equal(null);
      expect(utils.merge(null, 123)).to.equal(123);
      expect(utils.merge('string', null)).to.equal(null);
      expect(utils.merge(null, '123')).to.equal('123');
    });

    it('deep merge objects properly', () => {
      const source = {
        state: 'ACTIVATED',
        leg: {
          startTime: 123456,
          endTime: '123456',
          agencyId: 'maas-ticket',
          fooBar: 'baz',
        },
      };
      const delta = {
        leg: {
          startTime: '23456',
          endTime: 23456,
          agencyId: null,
        },
      };
      const result = {
        state: 'ACTIVATED',
        leg: {
          startTime: '23456',
          endTime: 23456,
          agencyId: null,
          fooBar: 'baz',
        },
      };

      expect(utils.merge(source, delta)).to.deep.equal(result);
    });
  });

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

  describe('mapDeep', () => {
    const order = [];
    const replacements = [11, 22, 33, 44, 55];

    it('should walk the object in-order', () => {
      const value = {
        one: 1,
        x: {
          two: 2,
          x: {
            three: 3,
          },
          fourAndFive: [4, 5],
        },
      };
      const mapped = utils.mapDeep(value, val => {
        order.push(value);
        return replacements.shift();
      });

      expect(mapped).to.deep.equal({
        one: 11,
        x: {
          two: 22,
          x: {
            three: 33,
          },
          fourAndFive: [44, 55],
        },
      });
    });
  });

  describe('cloneDeep', () => {
    const original = {
      number: 1,
      string: 'string',
      null: null,
      object: {
        number: 2,
        object: {
          number: 3,
          array: [1, { object: { number: 1 } }],
        },
      },
    };
    let cloned;

    before(() => {
      cloned = utils.cloneDeep(original);
    });

    it('should be able to clone complex objects', () => {
      expect(cloned).to.deep.equal(original);
    });

    it('should create copies of the values, not references', () => {
      const original = {
        object: { number: 1 },
      };
      const expected = {
        object: { number: 1 },
      };
      const cloned = utils.cloneDeep(original);
      original.object = null;

      expect(cloned).to.deep.equal(expected);
    });
  });

  describe('toFixed', () => {
    it('should return plain string as-is', () => {
      const value = 'foobar';
      expect(utils.toFixed(value, 2)).to.equal('foobar');
    });

    it('should convert a plain decimal number to fixed decimals', () => {
      const value = 1.23456;
      expect(utils.toFixed(value, 2)).to.equal(1.23);
    });

    it('should leave an integer untouched', () => {
      const value = 123456;
      expect(Number.isInteger(utils.toFixed(value, 2))).to.equal(true);
    });

    it('should convert to fixed numbers recursively', () => {
      const value = {
        simpleValue: 'simple',
        floatValue: 12345.6,
        nestedObject: {
          floatValue: 123.456,
          nestedObject: {
            integer: 234,
            //nullValue: null, // FIXME There's something wrong with nulls
            simpleString: 'string',
          },
        },
        nestedArray: [1.23456, 123.456],
      };

      expect(utils.toFixed(value, 1)).to.deep.equal({
        simpleValue: 'simple',
        floatValue: 12345.6,
        nestedObject: {
          floatValue: 123.5,
          nestedObject: {
            integer: 234,
            //nullValue: null, // FIXME There's something wrong with nulls
            simpleString: 'string',
          },
        },
        nestedArray: [1.2, 123.5],
      });
    });
  });
});
