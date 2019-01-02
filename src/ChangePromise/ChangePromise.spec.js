import bottleFactory from '../bottle';

describe('looking-glass-engine', () => {
  let bottle;

  beforeEach(() => {
    bottle = bottleFactory();
  });

  describe('ChangePromise', () => {
    let ChangePromise;
    beforeEach(() => {
      ChangePromise = bottle.container.ChangePromise;
    });

    describe('(constructor)', () => {
      const setAto2 = state => Object.assign({}, state, { a: 2 });

      it('should accept a value', () => {
        const change = new ChangePromise(2);
        expect(change.change).toEqual(2);
      });

      it('should accept an object', () => {
        const change = new ChangePromise({ a: 1, b: 2 });
        expect(change.change).toEqual({ a: 1, b: 2 });
      });

      it('should accept a function', () => {
        const change = new ChangePromise(setAto2);
        expect(change.change).toEqual(setAto2);
      });

      it('should accept a promise', async () => {
        const change = new ChangePromise(Promise.resolve(setAto2));
        const changeResolved = await change.change;
        expect(changeResolved).toEqual(setAto2);
      });

      it('should accept metadata', () => {
        const STATUS = Symbol('status');

        const change = new ChangePromise(2, { status: STATUS });

        expect(change.info.status).toEqual(STATUS);
      });
    });

    describe('resolution', () => {
      let thenFeedback = null;
      let change;
      beforeEach(() => {
        thenFeedback = null;
        change = new ChangePromise(2);
        change.then((value) => {
          thenFeedback = value;
        });
      });

      it('should not immediately resolve', () => {
        expect(thenFeedback).toEqual(null);
      });

      it('should pass through the current value on resolve (no args)', async () => {
        change.resolve();
        await change.promise;

        expect(thenFeedback).toEqual(2);
      });

      it('should pass through a synchronous value on resolve', async () => {
        change.resolve(4);
        await change.promise;

        expect(thenFeedback).toEqual(4);
      });

      it('should retain the first value on multiple resolve attempts', async () => {
        change.resolve(4);
        change.resolve(8);
        await change.promise;

        expect(thenFeedback).toEqual(4);
      });

      it('should pass through a promises\' unravelled value on resolve', async () => {
        change.resolve(Promise.resolve(4));
        await change.promise;

        expect(thenFeedback).toEqual(4);
      });

      it('should pass through a change\'s unravelled value on resolve (no args)', async () => {
        change = new ChangePromise(Promise.resolve(6));
        change.then((value) => {
          thenFeedback = value;
        });

        change.resolve();
        await change.promise;

        expect(thenFeedback).toEqual(6);
      });

      it('should ignore resolve\'s arguments if resolved', async () => {
        change._done(5); // a hackish way of saying, someone else already resolved the change
        await change.promise;
        change.resolve(10);
        await change.promise;

        expect(thenFeedback).toEqual(5);
      });
    });

    describe('rejection', () => {
      let thenFeedback = null;
      let catchFeedback = null;
      let change;
      beforeEach(() => {
        thenFeedback = null;
        change = new ChangePromise(2);
      });

      it('should not immediately return', () => {
        expect(thenFeedback).toBe(null);
      });

      it('should accept a rejected value', async () => {
        expect.assertions(1);
        try {
          change.reject(new Error('bad thing'));
          await change.promise;
        } catch (err) {
          catchFeedback = err;
        }
        expect(catchFeedback.message).toEqual('bad thing');
      });
    });
  });
});
