/* eslint-disable camelcase */
const tap = require('tap');
const p = require('../package.json');

const { ValueStream, ValueObjectStream, ABSENT } = require('../lib/index');

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

    testVS.test('odd rsult from actions', (ore) => {
      const REQUEST_STATUS_NEW = Symbol('new');
      const REQUEST_STATUS_WORKING = Symbol('working');
      const REQUEST_STATUS_FINISHED = Symbol('finished');
      const REQUEST_STATUS_ERROR = Symbol('error');
      const REQUEST_STATUS_TIMEOUT = Symbol('timeout');

      const makeRequest = (action, params) => new ValueObjectStream({
        action,
        params,
        out: null,
        status: REQUEST_STATUS_NEW,
      },
      {
        actions: {
          isOpen(self) {
            return [REQUEST_STATUS_NEW, REQUEST_STATUS_WORKING].includes(self.my.status);
          },
          work(self) {
            if (self.my.status === REQUEST_STATUS_NEW) {
              return self.do.setStatus(REQUEST_STATUS_WORKING);
            }
            console.warn('attempt to work a request that is status ', self.my.status);
            throw new Error('cannot work this request');
          },
          finish(self, response = Å) {
            if (self.do.isOpen()) {
              const trans = self.trans(-1);
              try {
                self.do.setOut(response);
                const { thrownError } = self.do.setStatus(REQUEST_STATUS_FINISHED);
                if (thrownError) console.log('finished error:', thrownError);
              } catch (err) {
                console.log(' error on finish:', err.message);
              }
              trans.complete();
            } else {
              console.warn('!!!!!!!!! attempt to finish a non-opened request', self);
            }
          },
          fail(self, err) {
            if (self.do.isOpen()) {
              const trans = self.trans(-1);
              try {
                if (err) { self.do.setOut(err); }
                const evt = self.do.setStatus(REQUEST_STATUS_ERROR);
                if (evt && evt.thrownError) console.log('FAIL: thrown:', evt.thrownError, 'from status:', self.value);
              } catch (err2) {
                console.log('error failing: (ha!)', err2);
              }
              trans.complete();
            } else {
              console.warn('attempt to fails a non-opened request', self);
            }
          },
          expire(self) {
            if ([REQUEST_STATUS_NEW, REQUEST_STATUS_WORKING].includes(self.my.status)) {
              self.do.setStatus(REQUEST_STATUS_TIMEOUT);
            }
          },
        },
      });

      const request = makeRequest('get', 2);
      request.do.finish('foo');
      ore.same(request.my.status, REQUEST_STATUS_FINISHED);
      ore.same(request.my.out, 'foo');

      ore.end();
    });

    testVS.end();
  });
  suite.end();
});
