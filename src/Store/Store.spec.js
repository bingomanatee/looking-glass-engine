import bottle from './../bottle';

describe('Store', () => {
  let Store;
  let STORE_STATUS_NEW;
  let STORE_STATUS_INITIALIZED;
  let STORE_STATUS_INITIALIZING;
  let STORE_STATE_UNSET_VALUE;
  let store;
  let debug;

  beforeEach(() => {
    const b = bottle();
    Store = b.container.Store;
    STORE_STATUS_NEW = b.container.STORE_STATUS_NEW;
    STORE_STATE_UNSET_VALUE = b.container.STORE_STATE_UNSET_VALUE;
    STORE_STATUS_INITIALIZING = b.container.STORE_STATUS_INITIALIZING;
    STORE_STATUS_INITIALIZED = b.container.STORE_STATUS_INITIALIZED;
  });

  describe('with initializer (async) and no initialValue', () => {
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

    describe('before initialize', () => {
      it('should start with state STORE_STATE_UNSET_VALUE', () => {
        expect(store.state).toEqual(STORE_STATE_UNSET_VALUE);
      });

      it('should start with status STORE_STATUS_NEW', () => {
        expect(store.status).toEqual(STORE_STATUS_NEW);
      });
    });

    describe('after initialize (immediately)', () => {
      it('should have state STORE_STATE_UNSET_VALUE', () => {
        store.initialize();
        expect(store.state).toEqual(STORE_STATE_UNSET_VALUE);
      });

      it('should still have status STORE_STATUS_INITIALIZING', () => {
        store.initialize();
        expect(store.status).toEqual(STORE_STATUS_INITIALIZING);
      });
    });

    describe('after initialize (async)', async () => {
      it('should have the right state', async () => {
        await store.initialize();
        expect(store.state).toEqual({ a: 1, b: 2 });
      });

      it('should set status STORE_STATUS_INITIALIZED', async () => {
        await store.initialize();
        expect(store.status).toEqual(STORE_STATUS_INITIALIZED);
      });
    });
  });

  describe('with initializer (sync) and no initialValue', () => {
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

    describe('before initialize', () => {
      it('should start with state STORE_STATE_UNSET_VALUE', () => {
        expect(store.state).toEqual(STORE_STATE_UNSET_VALUE);
      });

      it('should start with status STORE_STATUS_NEW', () => {
        expect(store.status).toEqual(STORE_STATUS_NEW);
      });
    });

    describe('after initialize', () => {
      it('should set the state to the value synchronously', () => {
        store.initialize();
        expect(store.state).toEqual({ a: 1, b: 2 });
      });
      it('should set the status synchronously', () => {
        store.initialize();
        expect(store.status).toEqual(STORE_STATUS_INITIALIZED);
      });
    });
  });

  describe('with initializer(sync) and initialValue', () => {
    beforeEach(() => {
      store = new Store({
        state: ({
          a: 1,
          b: 1,
        }),
        initializer: () => ({
          a: 2,
          b: 2,
        }),
        debug: true,
      });

      debug = [];

      store._debugStream.subscribe((value) => {
        debug.push(value);
      });
    });

    describe('before initialize', () => {
      it('should start with status STORE_STATUS_NEW', () => {
        expect(store.status).toEqual(STORE_STATUS_NEW);
      });


      it('should have the state value state', () => {
        expect(store.state).toEqual({ a: 1, b: 1 });
      });
    });

    describe('after initialize (sync)', () => {
      it('should have the state STORE_STATUS_INITIALIZED', () => {
        store.initialize();
        expect(store.status).toEqual(STORE_STATUS_INITIALIZED);
      });
      it('should have the state of the initializer', () => {
        store.initialize();
        expect(store.state).toEqual({ a: 2, b: 2 });
      });
    });
  });

  describe('with initializer(async) and initialValue', () => {
    beforeEach(() => {
      store = new Store({
        state: ({
          a: 1,
          b: 1,
        }),
        initializer: () => Promise.resolve({
          a: 2,
          b: 2,
        }),
        debug: true,
      });

      debug = [];

      store._debugStream.subscribe((value) => {
        debug.push(value);
      });
    });

    describe('before initialize', () => {
      it('should start with status STORE_STATUS_NEW', () => {
        expect(store.status).toEqual(STORE_STATUS_NEW);
      });


      it('should have the state value state', () => {
        expect(store.state).toEqual({ a: 1, b: 1 });
      });
    });

    describe('after initialize (sync)', () => {
      it('should have the state STORE_STATUS_INITIALIZING', () => {
        store.initialize();
        expect(store.status).toEqual(STORE_STATUS_INITIALIZING);
      });
      it('should have the state of the initializer', () => {
        store.initialize();
        expect(store.state).toEqual({ a: 1, b: 1 });
      });
    });

    describe('after initialize (async)', () => {
      it('should have the state STORE_STATUS_INITIALIZED', async () => {
        await store.initialize();
        expect(store.status).toEqual(STORE_STATUS_INITIALIZED);
      });

      it('should have the state of the initializer', async () => {
        await store.initialize();
        expect(store.state).toEqual({ a: 2, b: 2 });
      });
    });
  });

  describe('with no initializer and an initialValue', () => {
    beforeEach(() => {
      store = new Store({
        state: ({
          a: 1,
          b: 1,
        }),
        debug: true,
      });

      debug = [];

      store._debugStream.subscribe((value) => {
        debug.push(value);
      });
    });

    describe('before initialize', () => {
      it('should start with initial state ', () => {
        expect(store.state).toEqual({ a: 1, b: 1 });
      });

      it('should start with status STORE_STATUS_NEW', () => {
        // this is debatable; its "as initialized as it will ever be"
        // but still, its initialization method hasn't been called.
        expect(store.status).toEqual(STORE_STATUS_NEW);
      });
    });

    describe('after initialize (immediately)', () => {
      it('should have same state', () => {
        store.initialize();
        expect(store.state).toEqual({ a: 1, b: 1 });
      });

      it('should still have status STORE_STATUS_INITIALIZED', () => {
        store.initialize();
        expect(store.status).toEqual(STORE_STATUS_INITIALIZED);
      });
    });
  });
});
