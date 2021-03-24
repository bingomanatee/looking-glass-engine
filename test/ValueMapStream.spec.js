/* eslint-disable camelcase */

const { BehaviorSubject, Subject } = require('rxjs');
const { tap: tapFilter, map } = require('rxjs/operators');
const tap = require('tap');
const mergeMaps = require('../src/mergeMaps');

const p = require('../package.json');

const { ValueMapStream, ValueStream } = require('../lib');

const initial = Object.freeze(
  new Map([
    ['a', 1],
    ['b', ['alpha', 'beta', 'gamma']],
  ]),
);

tap.test(p.name, (suite) => {
  suite.test('ValueMapStream', (testVS) => {
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

    testVS.test('onField', (onFieldTest) => {
      onFieldTest.test('singular effects', (onFieldSingle) => {
        const coord = new ValueMapStream({
          x: 0,
          y: 0,
        });

        coord.subscribe({
          error(err) {
            console.log('stream error:', err);
          },
        });

        coord.onField((e) => {
          e.next(mergeMaps(e.value, new Map([['x', 2 * e.value.get('x')]])));
        }, 'x');
        coord.onField((e) => {
          e.next(mergeMaps(e.value, new Map([['y', 0.5 * e.value.get('y')]])));
        }, 'y');

        coord.set('x', 4);

        onFieldSingle.same(coord.my.x, 8);
        onFieldSingle.same(coord.my.y, 0);

        coord.set('y', 2);

        onFieldSingle.same(coord.my.x, 8);
        onFieldSingle.same(coord.my.y, 1);

        coord.next(new Map([['x', 3]]));
        onFieldSingle.same(coord.my.x, 6);
        onFieldSingle.same(coord.my.y, 1);

        onFieldSingle.end();
      });

      onFieldTest.test('error handling', (onFieldErr) => {
        const coord = new ValueMapStream({
          x: 0,
          y: 0,
        });

        const throwIfNotNumber = (field) => (event) => {
          if (!(typeof event.value.get(field) === 'number')) {
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

        const e1 = new Map([
          ['x', 0],
          ['y', 0],
        ]);
        const e2 = new Map([
          ['x', 2],
          ['y', 0],
        ]);
        const e2y1 = new Map([
          ['x', 2],
          ['y', 1],
        ]);
        const e3 = new Map([
          ['x', 4],
          ['y', 1],
        ]);
        const e4 = new Map([
          ['x', 4],
          ['y', 3],
        ]);
        const e4x6 = new Map([
          ['x', 6],
          ['y', 3],
        ]);

        onFieldErr.same(e1, coord.value);
        onFieldErr.same([], errors);
        onFieldErr.same(history, [e1]);

        coord.set('x', 2);

        onFieldErr.same(e2, coord.value);
        onFieldErr.same([], errors);
        onFieldErr.same(history, [e1, e2]);

        coord.set('x', 'three');
        onFieldErr.same(history, [e1, e2]);
        onFieldErr.same(errors, [
          'x must be a number',
        ]);

        coord.set('y', 1);
        onFieldErr.same(errors, [
          'x must be a number',
        ]);
        onFieldErr.same(history, [e1, e2, e2y1]);

        coord.set('x', 4);
        onFieldErr.same(errors, [
          'x must be a number',
        ]);
        onFieldErr.same(history, [e1, e2, e2y1, e3]);

        coord.set('x', 'five');
        onFieldErr.same(errors, [
          'x must be a number',
          'x must be a number',
        ]);
        onFieldErr.same(history, [e1, e2, e2y1, e3]);

        coord.set('y', 'two');

        onFieldErr.same(errors, [
          'x must be a number',
          'x must be a number',
          'y must be a number',
        ]);
        onFieldErr.same(history, [e1, e2, e2y1, e3]);

        coord.set('y', 3);
        coord.set('x', 6);
        onFieldErr.same(errors, [
          'x must be a number',
          'x must be a number',
          'y must be a number',
        ]);
        onFieldErr.same(history, [e1, e2, e2y1, e3, e4, e4x6]);

        onFieldErr.end();
      });
      onFieldTest.end();
    });

    testVS.test('watch', (wTest) => {
      const coord = new ValueMapStream({
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

      const startMap = new Map([
        ['x', 0],
        ['y', 0],
      ]);
      const nextMap = new Map([
        ['x', 1],
        ['y', 0],
      ]);
      const thirdMap = new Map([
        ['x', 1],
        ['y', 3],
      ]);
      wTest.same(history, [
        startMap,
      ]);

      coord.set(new Map([['x', 1]]));

      wTest.same(history, [
        startMap,
        nextMap,
      ]);

      coord.set(new Map([['z', 2]]));

      wTest.same(history, [
        startMap,
        nextMap,
      ]);

      coord.set(new Map([['y', 3]]));

      wTest.same(history, [
        startMap,
        nextMap,
        thirdMap,
      ]);
      wTest.end();
    });

    testVS.test('watch - sequential', (wTest) => {
      const coord = new ValueMapStream({
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
          if (value.get('x') % 2) {
            coord.set('error', 'x must be even');
          } else {
            coord.set('error', '');
          }
        });

      const startMap = new Map([
        ['x', 0],
        ['error', ''],
      ]);
      const nextMapPre = new Map([
        ['x', 1],
        ['error', ''],
      ]);
      const nextMap = new Map([
        ['x', 1],
        ['error', 'x must be even'],
      ]);
      const thirdMapPre = new Map([
        ['x', 2],
        ['error', 'x must be even'],
      ]);
      const thirdMap = new Map([
        ['x', 2],
        ['error', ''],
      ]);
      const fourthMap = new Map([
        ['x', 3],
        ['error', 'x must be even'],
      ]);

      wTest.same(history, [
        startMap,
        startMap,
      ]);

      coord.set(new Map([['x', 1]]));

      wTest.same(history, [
        startMap,
        startMap,
        nextMapPre,
        nextMap,
      ]);

      coord.set(new Map([['x', 2]]));

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
      const coord = new ValueMapStream({
        a: 1,
        b: 2,
        c: 3,
      });

      coord.delete('b');

      dTest.same(coord.object, { a: 1, c: 3 });

      dTest.end();
    });

    testVS.test('fieldSubjects', (fTest) => {
      const makeRoundNumSubject = (n = 0) => (
        new BehaviorSubject(n).pipe(map((value) => Math.round(value)))
      );

      const coord = new ValueMapStream({
        x: 0, y: 0,
      });

      coord.addFieldSubject('x', makeRoundNumSubject(0));
      coord.addFieldSubject('y', makeRoundNumSubject(0));

      coord.set('x', 1.5);

      fTest.same(coord.my.x, 2);

      fTest.test('cascading errors', (ce) => {
        const makeNumSubject = (n = 0) => {
          const sub = new ValueStream(n);

          sub.filter((a) => {
            console.log('--- sub filtering ', a);
            if (typeof a !== 'number') throw new Error('must be a number');
            return a;
          });
          return sub;
        };

        const coord = new ValueMapStream({
          x: 0, y: 0,
        });

        coord.addFieldSubject('x', makeNumSubject(0));
        coord.addFieldSubject('y', makeNumSubject(0));
        const errs = [];
        coord.subscribe({
          error(er) {
            errs.push(er);
          },
        });

        coord.set('x', 4);
        ce.same(errs.map((e) => e.message), []);

        coord.set('y', 'three');
        ce.same(errs.map((e) => e.message), ['must be a number']);

        ce.same(coord.object, { x: 4, y: 0 });

        coord.set('y', 6);
        ce.same(coord.object, { x: 4, y: 6 });
        ce.end();
      });
      fTest.end();
    });

    testVS.end();
  });

  suite.end();
});
