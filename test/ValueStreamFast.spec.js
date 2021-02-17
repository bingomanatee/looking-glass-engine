/* eslint-disable camelcase */
import {
  produce, createDraft, enableMapSet, current,
} from 'immer';

enableMapSet();
const tap = require('tap');
const p = require('../package.json');

const { ValueStreamFast: ValueStream, ABSENT } = require('../lib/index');

tap.test(p.name, (suite) => {
  suite.test('ValueStreamFast', (testVS) => {
    testVS.test('constructor', (testVSc) => {
      testVSc.test('basic', (basicTest) => {
        const basic = new ValueStream(3);

        basicTest.same(basic.value, 3);
        basicTest.end();
      });
      testVSc.test('named', (namedTest) => {
        const named = new ValueStream(3, { name: 'Bob' });

        namedTest.same(named.value, 3);
        namedTest.same(named.name, 'Bob');
        namedTest.end();
      });

      testVSc.end();
    });

    testVS.test('next', (testVSNext) => {
      const basic = new ValueStream(3);

      basic.next(4);
      testVSNext.same(basic.value, 4);

      basic.next(8);
      testVSNext.same(basic.value, 8);

      testVSNext.end();
    });

    testVS.end();
  });

  suite.end();
});
