import bottle from './../bottle';

describe('Store', () => {
  let Store;
  let STORE_STATUS_UNINITIALIZED;
  let STORE_STATUS_INITIALIZED;
  let STORE_STATUS_INITIALIZING;
  let STORE_STATE_UNSET_VALUE;

  beforeEach(() => {
    const b = bottle();
    Store = b.container.Store;
    STORE_STATUS_UNINITIALIZED = b.container.STORE_STATUS_UNINITIALIZED;
    STORE_STATE_UNSET_VALUE = b.container.STORE_STATE_UNSET_VALUE;
    STORE_STATUS_INITIALIZING = b.container.STORE_STATUS_INITIALIZING;
    STORE_STATUS_INITIALIZED = b.container.STORE_STATUS_INITIALIZED;
  });

  describe('with initializer (async) and no initialValue', () => {
    describe('before initialize', () => {
      let store;
      let debug;

      beforeEach(() => {
        store = new Store({
          debug: true,
          initializer: () => Promise.resolve({
            a: 1,
            b: 2,
          }),
        });

        debug = [];

        store._debugStream.subscribe((value) => {
          debug.push(value);
        });
      });

      it('should start with state STORE_STATE_UNSET_VALUE', () => {
        expect(store.state)
          .toEqual(STORE_STATE_UNSET_VALUE);
      });

      it('should start with status STORE_STATUS_UNINITIALIZED', () => {
        expect(store.status)
          .toEqual(STORE_STATUS_UNINITIALIZED);
      });

      describe('after initialize (immediately)', () => {
        it('should still have state STORE_STATE_UNSET_VALUE', () => {
          store.initialize();
          expect(store.state)
            .toEqual(STORE_STATE_UNSET_VALUE);
        });

        it('should still have status STORE_STATUS_UNINITIALIZED', () => {
          store.initialize();
          expect(store.status)
            .toEqual(STORE_STATUS_UNINITIALIZED);
        });
      });

      describe('after initialize (async)', async () => {
        it('should have the right state', async () => {
          await store.initialize();
          expect(store.state)
            .toEqual({ a: 1, b: 2 });
        });

        it('should set status STORE_STATUS_INITIALIZED', async () => {
          await store.initialize();
          expect(store.status)
            .toEqual(STORE_STATUS_INITIALIZED);
        });
      });
    });
  });

  describe('with initializer (sync) and no initialValue', () => {
    describe('before initialize', () => {
      let store;
      let debug;

      beforeEach(() => {
        store = new Store({
          debug: true,
          initializer: () => ({
            a: 1,
            b: 2,
          }),
        });

        debug = [];

        store._debugStream.subscribe((value) => {
          debug.push(value);
        });
      });

      it('should start with state STORE_STATE_UNSET_VALUE', () => {
        expect(store.state)
          .toEqual(STORE_STATE_UNSET_VALUE);
      });

      it('should start with status STORE_STATUS_UNINITIALIZED', () => {
        expect(store.status)
          .toEqual(STORE_STATUS_UNINITIALIZED);
      });

      describe('after initialize', () => {
        it('should set the state to the value synchronously', () => {
          store.initialize();
          expect(store.state)
            .toEqual({
              a: 1,
              b: 2,
            });
        });
        it('should set the status synchronously', () => {
          store.initialize();
          expect(store.status)
            .toEqual(STORE_STATUS_INITIALIZED);
        });
      });
    });
  });
});
