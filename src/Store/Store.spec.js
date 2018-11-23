import bottle from './../bottle';

describe('Store', () => {
  let Store;
  let BASE_STATE_STATUS_UNINITIALIZED;
  let BASE_STATE_STATUS_INITIALIZED;
  let BASE_STATE_STATUS_INITIALIZING;
  let BASE_STATE_UNINITIALIZED_VALUE;

  beforeEach(() => {
    const b = bottle();
    Store = b.container.Store;
    BASE_STATE_STATUS_UNINITIALIZED = b.container.BASE_STATE_STATUS_UNINITIALIZED;
    BASE_STATE_UNINITIALIZED_VALUE = b.container.BASE_STATE_UNINITIALIZED_VALUE;
    BASE_STATE_STATUS_INITIALIZING = b.container.BASE_STATE_STATUS_INITIALIZING;
    BASE_STATE_STATUS_INITIALIZED = b.container.BASE_STATE_STATUS_INITIALIZED;
  });

  describe('before initialization', () => { // initial value but no initializer
    it('should broadcast first event', () => {
      const s = new Store(2);
      const results = [];
      s.subscribe(v => results.push(v));

      expect(results)
        .toEqual([{ state: 2, status: (BASE_STATE_STATUS_UNINITIALIZED) }]);
    });

    it('should update events', () => {
      const s = new Store(2);
      const results = [];
      s.subscribe(v => results.push(v));
      s.state = 3;
      // should not set state before initialization but....
      expect(results)
        .toEqual([{
          state: 2,
          status: (BASE_STATE_STATUS_UNINITIALIZED),
        }, {
          state: 3,
          status: (BASE_STATE_STATUS_UNINITIALIZED),
        }]);
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
          state: (BASE_STATE_UNINITIALIZED_VALUE),
          status: (BASE_STATE_STATUS_UNINITIALIZED),
        }]);
    });

    it('should respond to initializing', async () => {
      await s.initialize();
      expect(results)
        .toEqual([{
          state: (BASE_STATE_UNINITIALIZED_VALUE),
          status: (BASE_STATE_STATUS_UNINITIALIZED),
        }, {
          state: (BASE_STATE_UNINITIALIZED_VALUE),
          status: (BASE_STATE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (BASE_STATE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (BASE_STATE_STATUS_INITIALIZED),
        }]);
    });

    it('should not change value from multiple initializing', async () => {
      await s.initialize();
      await s.initialize();
      expect(results)
        .toEqual([{
          state: (BASE_STATE_UNINITIALIZED_VALUE),
          status: (BASE_STATE_STATUS_UNINITIALIZED),
        }, {
          state: (BASE_STATE_UNINITIALIZED_VALUE),
          status: (BASE_STATE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (BASE_STATE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (BASE_STATE_STATUS_INITIALIZED),
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
          state: 1,
          status: (BASE_STATE_STATUS_UNINITIALIZED),
        }]);
    });

    it('should respond to initializing', async () => {
      await s.initialize();
      expect(results)
        .toEqual([{
          state: 1,
          status: (BASE_STATE_STATUS_UNINITIALIZED),
        }, {
          state: 1,
          status: (BASE_STATE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (BASE_STATE_STATUS_INITIALIZING),
        }, {
          state: 2,
          status: (BASE_STATE_STATUS_INITIALIZED),
        }]);
    });
  });
});
