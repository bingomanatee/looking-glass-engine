/* eslint-disable camelcase */
const { BehaviorSubject, Subject } = require('rxjs');
const { tap: tapFilter, map } = require('rxjs/operators');
const tap = require('tap');
const { produce } = require('immer');
const mergeMaps = require('../src/mergeMaps');

const p = require('../package.json');

const { ValueObjectStream } = require('../lib');

const initial = Object.freeze(
  {
    a: 1,
    b: ['alpha', 'beta', 'gamma'],
  },
);

tap.test(p.name, (suite) => {
  suite.test('ValueObjectStream', (testVS) => {
    testVS.test('constructor', (testVSc) => {
      testVSc.test('basic', (basicTest) => {
        const basic = new ValueObjectStream({ ...initial });
        basicTest.same(basic.value, initial);
        basicTest.end();
      });

      testVSc.end();
    });

    testVS.test('next', (testVSNext) => {
      const basic = new ValueObjectStream({ ...initial });
      basic.next(
        { a: 2, c: 3 },
      );

      testVSNext.same(basic.value,
        {
          a: 2,
          b: ['alpha', 'beta', 'gamma'],
          c: 3,
        });

      testVSNext.end();
    });

    testVS.test('set', (testVSNext) => {
      const basic = new ValueObjectStream({ ...initial });
      basic.set('a', 100);

      testVSNext.same(basic.value,
        {
          a: 100,
          b: ['alpha', 'beta', 'gamma'],
        });

      basic.set('z', 200);

      testVSNext.same(basic.value,
        {
          a: 100,
          b: ['alpha', 'beta', 'gamma'],
          z: 200,
        });

      testVSNext.end();
    });

    testVS.test('onField', (afsTest) => {
      const coord = new ValueObjectStream({
        x: 0,
        y: 0,
      });

      const throwIfNotNumber = (field) => (event) => {
        if (!(typeof event.value[field] === 'number')) {
          event.error(new Error(`${field} must be a number`), event);
        }
      };

      coord.onField(throwIfNotNumber('x'), 'x');
      coord.onField(throwIfNotNumber('y'), 'y');

      const errors = [];
      const history = [];

      coord.subscribe({
        next: history.push.bind(history),
        error: (e) => {
          errors.push(e.message);
        },
      });

      const e1 = {
        x: 0, y: 0,
      };

      const e2 = {
        x: 2, y: 0,
      };

      const e2y1 = { x: 2, y: 1 };

      const e3 = { x: 4, y: 1 };

      const e4 = { x: 4, y: 3 };

      const e4x6 = { x: 6, y: 3 };

      afsTest.same(e1, coord.value);
      afsTest.same([], errors);
      afsTest.same(history, [e1]);

      coord.set('x', 2);

      afsTest.same(e2, coord.value);
      afsTest.same([], errors);
      afsTest.same(history, [e1, e2]);

      coord.set('x', 'three');
      afsTest.same(history, [e1, e2]);
      afsTest.same(errors, [
        'x must be a number',
      ]);

      coord.set('y', 1);
      afsTest.same(errors, [
        'x must be a number',
      ]);
      afsTest.same(history, [e1, e2, e2y1]);

      coord.set('x', 4);
      afsTest.same(errors, [
        'x must be a number',
      ]);
      afsTest.same(history, [e1, e2, e2y1, e3]);

      coord.set('x', 'five');
      afsTest.same(errors, [
        'x must be a number',
        'x must be a number',
      ]);
      afsTest.same(history, [e1, e2, e2y1, e3]);

      coord.set('y', 'two');
      afsTest.same(errors, [
        'x must be a number',
        'x must be a number',
        'y must be a number',
      ]);
      afsTest.same(history, [e1, e2, e2y1, e3]);

      coord.set('y', 3);
      coord.set('x', 6);
      afsTest.same(errors, [
        'x must be a number',
        'x must be a number',
        'y must be a number',
      ]);
      afsTest.same(history, [e1, e2, e2y1, e3, e4, e4x6]);

      afsTest.end();
    });

    testVS.test('watch', (wTest) => {
      const coord = new ValueObjectStream({
        x: 0,
        y: 0,
        z: 0,
      });

      const errors = [];
      const history = [];

      coord.watch('x', 'y')
        .subscribe({
          next: history.push.bind(history),
          error: errors.push.bind(errors),
        });

      coord.set(new Map([['z', 1]]));

      const startMap = { x: 0, y: 0 };
      const nextMap = { x: 1, y: 0 };
      const thirdMap = { x: 1, y: 3 };

      wTest.same(history, [
        startMap,
      ]);

      coord.set('x', 1);

      wTest.same(history, [
        startMap,
        nextMap,
      ]);

      coord.set('z', 2);

      wTest.same(history, [
        startMap,
        nextMap,
      ]);

      coord.set({ y: 3 });

      wTest.same(history, [
        startMap,
        nextMap,
        thirdMap,
      ]);
      wTest.end();
    });

    testVS.test('watch - sequential', (wTest) => {
      const coord = new ValueObjectStream({
        x: 0,
        error: '',
      });

      const errors = [];
      const history = [];

      coord
        .subscribe({
          next: history.push.bind(history),
          error: errors.push.bind(errors),
        });

      coord.watch('x')
        .subscribe((value) => {
          if (value.x % 2) {
            coord.set('error', 'x must be even');
          } else {
            coord.set('error', '');
          }
        });

      const startMap = { x: 0, error: '' };
      const nextMapPre = { x: 1, error: '' };
      const nextMap = { x: 1, error: 'x must be even' };
      const thirdMapPre = { x: 2, error: 'x must be even' };
      const thirdMap = { x: 2, error: '' };

      wTest.same(history, [
        startMap,
        startMap,
      ]);

      coord.set('x', 1);

      wTest.same(history, [
        startMap,
        startMap,
        nextMapPre,
        nextMap,
      ]);

      coord.set('x', 2);

      wTest.same(history, [
        startMap,
        startMap,
        nextMapPre,
        nextMap,
        thirdMapPre,
        thirdMap,
      ]);

      wTest.end();
    });

    testVS.test('delete', (dTest) => {
      const coord = new ValueObjectStream({
        a: 1,
        b: 2,
        c: 3,
      });

      coord.delete('b');

      dTest.same(coord.value, { a: 1, c: 3 });

      dTest.end();
    });

    testVS.test('fieldSubjects', (fTest) => {
      const makeRoundNumSubject = (n = 0) => (
        new BehaviorSubject(n).pipe(map((value) => Math.round(value)))
      );

      const coord = new ValueObjectStream({
        x: 0, y: 0,
      });

      coord.addFieldSubject('x', makeRoundNumSubject(0));
      coord.addFieldSubject('y', makeRoundNumSubject(0));

      coord.set('x', 1.5);

      fTest.same(coord.my.x, 2);
      fTest.end();
    });

    testVS.end();
  });

  suite.end();
});
