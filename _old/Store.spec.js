import bottle from './../bottle';

describe('Store', () => {
  let Store;
  let STORE_STATUS_UNINITIALIZED;
  let STORE_STATUS_INITIALIZED;
  let STORE_STATUS_INITIALIZING;
  let STORE_UNINITIALIZED_VALUE;

  beforeEach(() => {
    const b = bottle();
    Store = b.container.Store;
    STORE_STATUS_UNINITIALIZED = b.container.STORE_STATUS_UNINITIALIZED;
    STORE_UNINITIALIZED_VALUE = b.container.STORE_UNINITIALIZED_VALUE;
    STORE_STATUS_INITIALIZING = b.container.STORE_STATUS_INITIALIZING;
    STORE_STATUS_INITIALIZED = b.container.STORE_STATUS_INITIALIZED;
  });

  describe('before initialization', () => { // initial value but no initializer
    it('should broadcast first event', () => {
      const s = new Store(2);
      const results = [];
      s.subscribe(v => results.push(v));

      expect(results)
        .toEqual([{ state: STORE_UNINITIALIZED_VALUE, status: (STORE_STATUS_UNINITIALIZED) }]);
    });
  });

  describe('initializer but no initial value', () => {
    let s;
    let results;
    beforeEach(() => {
      s = new Store({ initializer: () => 2 });
      results = [];
      s.subscribe(v => results.push(v));
    });

    it('should broadcast first event', () => {
      expect(results)
        .toEqual([{
          state: (STORE_UNINITIALIZED_VALUE),
          status: (STORE_STATUS_UNINITIALIZED),
        }]);
    });

    it('should respond to initializing', async () => {
      await s.initialize();
      expect(results)
        .toEqual([{
          state: (STORE_UNINITIALIZED_VALUE),
          status: (STORE_STATUS_UNINITIALIZED),
        }, {
          state: (STORE_UNINITIALIZED_VALUE),
          status: (STORE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (STORE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (STORE_STATUS_INITIALIZED),
        }]);
    });

    it('should not change value from multiple initializing', async () => {
      await s.initialize();
      await s.initialize();
      expect(results)
        .toEqual([{
          state: (STORE_UNINITIALIZED_VALUE),
          status: (STORE_STATUS_UNINITIALIZED),
        }, {
          state: (STORE_UNINITIALIZED_VALUE),
          status: (STORE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (STORE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (STORE_STATUS_INITIALIZED),
        }]);
    });
  });
  describe('initializer and initial value', () => {
    let s;
    let results;
    beforeEach(() => {
      s = new Store({
        state: 1,
        initializer: () => 2,
      });
      results = [];
      s.subscribe(v => results.push(v));
    });

    it('should broadcast first event', () => {
      expect(results)
        .toEqual([{
          state: STORE_UNINITIALIZED_VALUE,
          status: (STORE_STATUS_UNINITIALIZED),
        }]);
    });

    it('should respond to initializing', async () => {
      await s.initialize();
      expect(results)
        .toEqual([{
          state: STORE_UNINITIALIZED_VALUE,
          status: (STORE_STATUS_UNINITIALIZED),
        }, {
          state: STORE_UNINITIALIZED_VALUE,
          status: (STORE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (STORE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (STORE_STATUS_INITIALIZED),
        }]);
    });
  });
});
