import bottle from './../bottle';

describe('StoreEngine', () => {
  let StoreEngine;
  let BASE_STATE_STATUS_UNINITIALIZED;
  let BASE_STATE_STATUS_INITIALIZED;
  let BASE_STATE_STATUS_INITIALIZING;
  let BASE_STATE_UNINITIALIZED_VALUE;
  let ACTION_START;
  let ACTION_COMPLETE;
  let store;
  let streamData;
  let actionStreamData;

  beforeEach(() => {
    const b = bottle();
    StoreEngine = b.container.StoreEngine;
    BASE_STATE_STATUS_UNINITIALIZED = b.container.BASE_STATE_STATUS_UNINITIALIZED;
    BASE_STATE_UNINITIALIZED_VALUE = b.container.BASE_STATE_UNINITIALIZED_VALUE;
    BASE_STATE_STATUS_INITIALIZING = b.container.BASE_STATE_STATUS_INITIALIZING;
    BASE_STATE_STATUS_INITIALIZED = b.container.BASE_STATE_STATUS_INITIALIZED;
    ACTION_START = b.container.ACTION_START;
    ACTION_COMPLETE = b.container.ACTION_COMPLETE;
    streamData = [];
    actionStreamData = [];
    store = new StoreEngine({
      state: {
        a: 1,
        b: 2,
      },
    }, {
      incB: context => Object.assign({}, context.state, { b: context.state.b + 1 }),
      incA: context => Object.assign({}, context.state, { a: context.state.a + 1 }),
      doBoth: async (context) => {
        await context.actions.incA();
        return context.actions.incB();
      },
    });
    store.subscribe((...args) => streamData.push(args));
    store.subscribeToActions((...args) => actionStreamData.push(args));
  });

  describe('initial values', () => {
    it('should start with the right state', () => {
      expect(store.state)
        .toEqual({
          a: 1,
          b: 2,
        });
    });
    it('should start with the right status', () => {
      expect(store.status)
        .toEqual(BASE_STATE_STATUS_UNINITIALIZED);
    });
    it('should start with the right stream data', () => {
      expect(streamData)
        .toEqual([[{
          state: {
            a: 1,
            b: 2,
          },
          status: (BASE_STATE_STATUS_UNINITIALIZED),
        }]]);
    });
  });

  describe('after initialize', () => {
    it('should start with expected stream states', async () => {
      await store.initialize();
      expect(streamData)
        .toEqual([[{
          state: {
            a: 1,
            b: 2,
          },
          status: BASE_STATE_STATUS_UNINITIALIZED,
        }], [{
          state: {
            a: 1,
            b: 2,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
        }]]);
      expect(actionStreamData)
        .toEqual([]);
    });
  });

  describe('after action', () => {
    it('should update the state after an action', async () => {
      await store.actions.incA();
      expect(store.state)
        .toEqual({
          a: 2,
          b: 2,
        });
    });

    it('should have an action stream that reflects state change', async () => {
      await store.actions.incA();
      expect(streamData)
        .toEqual([[{
          state: {
            a: 1,
            b: 2,
          },
          status: BASE_STATE_STATUS_UNINITIALIZED,
        }], [{
          state: {
            a: 1,
            b: 2,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
        }], [{
          state: {
            a: 2,
            b: 2,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
        }]]);
      expect(actionStreamData)
        .toEqual([[{
          name: 'incA',
          params: [],
          state: {
            a: 1,
            b: 2,
          },
          status: (BASE_STATE_STATUS_INITIALIZED),
          type: (ACTION_START),
        }], [{
          name: 'incA',
          params: [],
          state: {
            a: 2,
            b: 2,
          },
          status: (BASE_STATE_STATUS_INITIALIZED),
          type: (ACTION_START),
        }], [{
          name: 'incA',
          params: [],
          prevState: {
            a: 1,
            b: 2,
          },
          state: {
            a: 2,
            b: 2,
          },
          status: (BASE_STATE_STATUS_INITIALIZED),
          type: (ACTION_COMPLETE),
        }]]);
    });
  });

  describe('nested actions', () => {
    beforeEach(async () => {
      await store.actions.doBoth();
    });

    it('should execute both actions', () => {
      expect(store.state)
        .toEqual({
          a: 2,
          b: 3,
        });
    });

    it('should create the expected stream', () => {
      expect(actionStreamData)
        .toEqual([[{
          name: 'doBoth',
          params: [],
          state: {
            a: 1,
            b: 2,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_START,
        }], [{
          name: 'incA',
          params: [],
          state: {
            a: 1,
            b: 2,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_START,
        }], [{
          name: 'incA',
          params: [],
          state: {
            a: 2,
            b: 2,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_START,
        }], [{
          name: 'incA',
          params: [],
          prevState: {
            a: 1,
            b: 2,
          },
          state: {
            a: 2,
            b: 2,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_COMPLETE,
        }], [{
          name: 'incB',
          params: [],
          state: {
            a: 2,
            b: 2,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_START,
        }], [{
          name: 'incB',
          params: [],
          state: {
            a: 2,
            b: 3,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_START,
        }], [{
          name: 'incB',
          params: [],
          prevState: {
            a: 2,
            b: 2,
          },
          state: {
            a: 2,
            b: 3,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_COMPLETE,
        }], [{
          name: 'incB',
          params: [],
          prevState: {
            a: 2,
            b: 2,
          },
          state: {
            a: 2,
            b: 3,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_COMPLETE,
        }], [{
          name: 'doBoth',
          params: [],
          prevState: {
            a: 2,
            b: 3,
          },
          state: {
            a: 2,
            b: 3,
          },
          status: BASE_STATE_STATUS_INITIALIZED,
          type: ACTION_COMPLETE,
        }]]);
    });
  });
});
