import bottle from './../bottle';

describe('StoreEngine', () => {
  let StoreEngine;
  let STORE_STATUS_UNINITIALIZED;
  let STORE_STATUS_INITIALIZED;
  let STORE_STATUS_INITIALIZING;
  let STORE_UNINITIALIZED_VALUE;
  let ACTION_START;
  let ACTION_COMPLETE;
  let store;
  let streamData;
  let actionStreamData;
  let update;

  beforeEach(() => {
    const b = bottle();
    StoreEngine = b.container.StoreEngine;
    STORE_STATUS_UNINITIALIZED = b.container.STORE_STATUS_UNINITIALIZED;
    STORE_UNINITIALIZED_VALUE = b.container.STORE_UNINITIALIZED_VALUE;
    STORE_STATUS_INITIALIZING = b.container.STORE_STATUS_INITIALIZING;
    STORE_STATUS_INITIALIZED = b.container.STORE_STATUS_INITIALIZED;
    update = b.container.update;
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
      incB: () => state => Object.assign({}, state, { b: state.b + 1 }),
      incA: () => state => Object.assign({}, state, { a: state.a + 1 }),
      doBoth: async (actions) => {
        await actions.incA();
        await actions.incB();
        return state => state;
      },
    });
    store.subscribe((data) => {
      streamData.push(data);
    });
    store.subscribeToActions((data) => {
      actionStreamData.push(data);
    });
  });

  describe('nested actions', () => {
    beforeEach(async () => store.actions.doBoth());

    it('should execute both actions', () => {
      expect(store.state)
        .toEqual({
          a: 2,
          b: 3,
        });
    });
  });

  describe('with update in actions', () => {
    beforeEach(() => {
      store = new StoreEngine({
        a: 1,
        b: 2,
      }, { addToA: update((actions, n) => ({ a }) => ({ a: a + n })) });
    });

    it('should take a parameter to update', async () => {
      await store.actions.addToA(2);
      expect(store.state.a)
        .toEqual(3);
      expect(store.state.b)
        .toEqual(2);
    });
  });

  describe('streaming', () => {
    describe('initial values', () => {
      it('should start with the right stream data', () => {
        expect(streamData)
          .toEqual([{
            state: STORE_UNINITIALIZED_VALUE,
            status: STORE_STATUS_UNINITIALIZED,
          }]);
      });
    });

    describe('after initialize', () => {
      it('should start with expected stream states', async () => {
        await store.initialize();
        expect(streamData)
          .toEqual([{
            state: STORE_UNINITIALIZED_VALUE,
            status: STORE_STATUS_UNINITIALIZED,
          }, {
            state: STORE_UNINITIALIZED_VALUE,
            status: STORE_STATUS_INITIALIZING,
          }, {
            state: {
              a: 1,
              b: 2,
            },
            status: STORE_STATUS_INITIALIZING,
          }, {
            state: {
              a: 1,
              b: 2,
            },
            status: STORE_STATUS_INITIALIZED,
          }]);
        expect(actionStreamData)
          .toEqual([]);
      });
    });

    describe('after action', () => {
      it('should have an store stream that reflects state change', async () => {
        await store.actions.incA();
        expect(streamData)
          .toEqual([
            {
              state: STORE_UNINITIALIZED_VALUE,
              status: STORE_STATUS_UNINITIALIZED,
            },
            {
              state: STORE_UNINITIALIZED_VALUE,
              status: STORE_STATUS_INITIALIZING,
            },
            {
              state: {
                a: 1,
                b: 2,
              },
              status: STORE_STATUS_INITIALIZING,
            },
            {
              state: {
                a: 1,
                b: 2,
              },
              status: STORE_STATUS_INITIALIZED,
            },
            {
              state: {
                a: 2,
                b: 2,
              },
              status: STORE_STATUS_INITIALIZED,
            },
          ]);
      });

      it('should have an action stream that reflects state change', async () => {
        await store.actions.incA();
        expect(actionStreamData)
          .toEqual([{
            name: 'incA',
            params: [],
            state: {
              a: 1,
              b: 2,
            },
            status: STORE_STATUS_INITIALIZED,
            tid: {
              on: 100000,
              tid: 0,
            },
            type: ACTION_START,
          }, {
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
            status: STORE_STATUS_INITIALIZED,
            tid: {
              on: 100000,
              tid: 0,
            },
            type: ACTION_COMPLETE,
          }]);
      });
    });

    describe('nested actions', () => {
      beforeEach(async () => {
        await store.actions.doBoth();
      });

      it('should create the expected action stream', () => {
        expect(actionStreamData)
          .toEqual([{
            name: 'doBoth',
            params: [],
            state: {
              a: 1,
              b: 2,
            },
            status: STORE_STATUS_INITIALIZED,
            tid: {
              on: 100000,
              tid: 0,
            },
            type: ACTION_START,
          }, {
            name: 'incA',
            params: [],
            state: {
              a: 1,
              b: 2,
            },
            status: STORE_STATUS_INITIALIZED,
            tid: {
              on: 100000,
              tid: 1,
            },
            type: ACTION_START,
          }, {
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
            status: STORE_STATUS_INITIALIZED,
            tid: {
              on: 100000,
              tid: 1,
            },
            type: ACTION_COMPLETE,
          }, {
            name: 'incB',
            params: [],
            state: {
              a: 2,
              b: 2,
            },
            status: STORE_STATUS_INITIALIZED,
            tid: {
              on: 100000,
              tid: 2,
            },
            type: ACTION_START,
          }, {
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
            status: STORE_STATUS_INITIALIZED,
            tid: {
              on: 100000,
              tid: 2,
            },
            type: ACTION_COMPLETE,
          }, {
            name: 'doBoth',
            params: [],
            prevState: {
              a: 1,
              b: 2,
            },
            state: {
              a: 2,
              b: 3,
            },
            status: STORE_STATUS_INITIALIZED,
            tid: {
              on: 100000,
              tid: 0,
            },
            type: ACTION_COMPLETE,
          }]);
      });
    });
  });
});
