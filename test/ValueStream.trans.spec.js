/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../package.json');

const { ValueStream, ABSENT } = require('../lib/index');

tap.test(p.name, (suite) => {
  suite.test('ValueStream', (testVS) => {
    testVS.test('transactional locking', (testTL) => {
      const stream = new ValueStream(10, { debugTrans: true });
      testTL.same(stream.value, 10);
      let current = null;

      stream.subscribe({
        next: (v) => current = v,
      });

      testTL.same(current, 10);

      const t = stream.trans();

      stream.next(20);

      testTL.same(stream.value, 10);
      testTL.same(current, 10);
      t.complete();
      testTL.same(stream.value, 20);
      testTL.same(current, 20);

      testTL.end();
    });

    testVS.test('timeouts', async (testTL) => {
      const stream = new ValueStream(10, { debugTrans: true });
      testTL.same(stream.value, 10);
      let current = null;

      stream.subscribe({
        next: (v) => current = v,
      });

      testTL.same(current, 10);

      const t = stream.trans(100);

      stream.next(20);

      testTL.same(stream.value, 10);
      testTL.same(current, 10);

      await (new Promise((done) => setTimeout(done, 200)));
      // after 200 milliseconds, transactions should complete
      testTL.same(stream.value, 20);
      testTL.same(current, 20);

      testTL.end();
    });

    testVS.test('timeouts-zero', async (testTL) => {
      const stream = new ValueStream(10, { debugTrans: true });
      testTL.same(stream.value, 10);
      let current = null;

      stream.subscribe({
        next: (v) => current = v,
      });

      testTL.same(current, 10);

      const t = stream.trans(0);

      stream.next(20);

      testTL.same(stream.value, 10);
      testTL.same(current, 10);

      await (new Promise((done) => setTimeout(done, 20)));
      // after 200 milliseconds, transactions should complete
      testTL.same(stream.value, 20);
      testTL.same(current, 20);

      testTL.end();
    });

    testVS.test('no-lifespan timeouts', async (testTL) => {
      const stream = new ValueStream(10, { debugTrans: true });
      testTL.same(stream.value, 10);
      let current = null;

      stream.subscribe({
        next: (v) => current = v,
      });

      testTL.same(current, 10);

      const t = stream.trans(-1);

      stream.next(20);

      testTL.same(stream.value, 10);
      testTL.same(current, 10);

      await (new Promise((done) => setTimeout(done, 2000)));

      testTL.same(stream.value, 10);
      testTL.same(current, 10);

      t.complete();
      // after 200 milliseconds, transactions should complete
      testTL.same(stream.value, 20);
      testTL.same(current, 20);

      testTL.end();
    });

    testVS.end();
  });
  suite.end();
});
