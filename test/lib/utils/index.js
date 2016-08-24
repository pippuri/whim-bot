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
});
