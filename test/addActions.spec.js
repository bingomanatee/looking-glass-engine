/* eslint-disable camelcase */
import produce from 'immer';

const tap = require('tap');
const p = require('../package.json');

const { ValueStream, ValueMapStream, addActions } = require('../lib/index');

tap.test(p.name, (suite) => {
  suite.test('addActions', (testA) => {
    testA.test('simple actions', (sim) => {
      const stream = addActions(
        new ValueStream({ x: 0, y: 0 }),
        {
          offset(s, dX, dY) {
            const next = { ...s.value };
            next.x += dX;
            next.y += dY;
            s.next(next);
          },
          magnitude({ value: { x, y } }) {
            return Math.round(Math.sqrt(x ** 2 + y ** 2));
          },
        },
      );

      sim.same(stream.value, { x: 0, y: 0 });
      sim.same(stream.do.magnitude(), 0);
      stream.do.offset(2, 5);
      sim.same(stream.value, { x: 2, y: 5 });
      sim.same(stream.do.magnitude(), 5);
      stream.do.offset(2, 7);
      sim.same(stream.value, { x: 4, y: 12 });
      sim.same(stream.do.magnitude(), 13);
      sim.end();
    });

    testA.test('map setters', (msTest) => {
      const coord = addActions(new ValueMapStream({
        x: 0,
        y: 0,
      }));

      coord.do.setX(3);

      msTest.same(coord.value, new Map([['x', 3], ['y', 0]]));

      coord.do.setY(4);

      msTest.same(coord.value, new Map([
        ['x', 3],
        ['y', 4],
      ]));

      msTest.end();
    });

    testA.test('response to non-existent actions', (non) => {
      const stream = addActions(
        new ValueStream({ x: 0, y: 0 }),
        {
          offset(s, dX, dY) {
            const next = { ...s.value };
            next.x += dX;
            next.y += dY;
            s.next(next);
          },
          magnitude({ value: { x, y } }) {
            return Math.round(Math.sqrt(x ** 2 + y ** 2));
          },
        },
      );

      let msg = '';
      try {
        stream.do.normalize();
      } catch (err) {
        msg = err.message;
      }

      non.same(msg, 'no action normalize');

      try {
        stream.do.setZ(3);
      } catch (err) {
        msg = err.message;
      }

      non.end();
    });

    testA.test('getting feedback from set', (feedback) => {
      const stream = addActions(
        new ValueMapStream({ x: 0, y: 0 }),
        {
          magnitude({ value: { x, y } }) {
            return Math.round(Math.sqrt(x ** 2 + y ** 2));
          },
        },
      );

      const xStream = new ValueStream(0);
      xStream.filter((value, event) => {
        if (value < 0) {
          throw new Error('x must be positive');
        }
        return value;
      });
      stream.addFieldSubject('x', xStream);

      const { value: value1, thrownError: te1 } = stream.do.setY(4);
      feedback.same(value1.get('y'), 4);
      feedback.notOk(te1);
      feedback.same(stream.my.y, 4);

      const evt = stream.do.setX(6);
      const { value: value2, thrownError: te2 } = evt;

      feedback.same(value2.get('x'), 6);
      feedback.notOk(te2);
      feedback.same(stream.my.x, 6);

      const ev3 = stream.do.setX(-6);
      const { thrownError: te3 } = ev3;

      feedback.same(te3.message, 'x must be positive');
      feedback.same(stream.my.x, 6);

      stream.do.setX(4);
      feedback.same(stream.my.x, 4);

      feedback.end();
    });

    testA.test('throwing in an action', (ta) => {
      const stream = addActions(
        new ValueMapStream({ x: 0, y: 0 }),
        {
          angle(str) {
            if (str.my.x === 0 && str.my.y === 0) throw new Error('cannot get angle from origin');
            return Math.atan2(str.my.y, str.my.x);
          },
        },
      );

      try {
        const magnitude = stream.do.angle();
        console.log('magnitude:', magnitude);
      } catch (err) {
        ta.same(err.message, 'cannot get angle from origin', 'action throws');
      }

      ta.end();
    });

    testA.end();
  });

  suite.end();
});
