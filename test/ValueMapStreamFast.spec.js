/* eslint-disable camelcase */
import { produce } from 'immer';
import { BehaviorSubject, Subject } from 'rxjs';
import { tap as tapFilter } from 'rxjs/operators';

const tap = require('tap');
const p = require('../package.json');

const { ValueMapStreamFast: ValueMapStream, ValueStream } = require('../lib');

const initial = Object.freeze(
  new Map([
    ['a', 1],
    ['b', ['alpha', 'beta', 'gamma']],
  ]),
);

tap.test(p.name, (suite) => {
  suite.test('ValueMapStreamFast', (testVS) => {
    testVS.test('constructor', (testVSc) => {
      testVSc.test('basic', (basicTest) => {
        const basic = new ValueMapStream(new Map(initial));

        basicTest.same(basic.value, initial);
        basicTest.end();
      });

      testVSc.end();
    });

    testVS.test('next', (testVSNext) => {
      const basic = new ValueMapStream(new Map(initial));
      basic.next(new Map([['a', 2], ['c', 3]]));

      testVSNext.same(basic.value, new Map([
        ['a', 2],
        ['b', ['alpha', 'beta', 'gamma']],
        ['c', 3],
      ]));

      testVSNext.end();
    });

    testVS.test('set', (testVSNext) => {
      const basic = new ValueMapStream(new Map(initial));
      basic.set('a', 100);

      testVSNext.same(basic.value, new Map([
        ['a', 100],
        ['b', ['alpha', 'beta', 'gamma']],
      ]));

      basic.set('z', 200);

      testVSNext.same(basic.value, new Map([
        ['a', 100],
        ['b', ['alpha', 'beta', 'gamma']],
        ['z', 200],
      ]));

      testVSNext.end();
    });

    testVS.test('delete', (dTest) => {
      const coord = new ValueMapStream({
        a: 1,
        b: 2,
        c: 3,
      });

      console.log('--- object before delete:', coord.object);
      coord.delete('b');
      console.log('--- object after delete:', coord.object);
      console.log('--- value after delete:', coord.value);

      dTest.same(coord.object, { a: 1, c: 3 });

      dTest.end();
    });

    testVS.end();
  });

  suite.end();
});
