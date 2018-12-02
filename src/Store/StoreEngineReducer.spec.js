import bottle from './../bottle';

describe('StoreEngineReducer', () => {
  let StoreEngine;
  let StoreEngineReducer;
  let BASE_STATE_STATUS_UNINITIALIZED;
  let BASE_STATE_STATUS_INITIALIZED;
  let BASE_STATE_STATUS_INITIALIZING;
  let BASE_STATE_UNINITIALIZED_VALUE;
  let ACTION_START;
  let ACTION_COMPLETE;
  let store;
  let store2;
  let storeCombined;
  let streamData;
  let update;

  beforeEach(() => {
    const b = bottle();
    StoreEngine = b.container.StoreEngine;
    StoreEngineReducer = b.container.StoreEngineReducer;
    BASE_STATE_STATUS_UNINITIALIZED = b.container.BASE_STATE_STATUS_UNINITIALIZED;
    BASE_STATE_UNINITIALIZED_VALUE = b.container.BASE_STATE_UNINITIALIZED_VALUE;
    BASE_STATE_STATUS_INITIALIZING = b.container.BASE_STATE_STATUS_INITIALIZING;
    BASE_STATE_STATUS_INITIALIZED = b.container.BASE_STATE_STATUS_INITIALIZED;
    update = b.container.update;
    ACTION_START = b.container.ACTION_START;
    ACTION_COMPLETE = b.container.ACTION_COMPLETE;
    streamData = [];
    store = new StoreEngine({
      state: {
        a: 1,
        b: 2,
      },
    }, {
      incB: () => state => Object.assign({}, state, { b: state.b + 10 }),
      incA: () => state => Object.assign({}, state, { a: state.a + 1 }),
      doBoth: async (context) => {
        console.log('doing Both');
        await context.actions.incA();
        await context.actions.incB();
        return state => state;
      },
    });

    store2 = new StoreEngine(
      {
        state: {
          a: 10,
          c: 44,
        },
      },
      {
        incA: () => state => Object.assign({}, state, { a: state.a + 1 }),
        doubleC: () => state => Object.assign({}, state, { c: state.c * 2 }),
      },
    );

    storeCombined = new StoreEngineReducer([store, store2]);
  });

  it('should initialize to a combination of the states', async () => {
    await storeCombined.initialize();
    expect(storeCombined.state)
      .toEqual({
        a: 10,
        b: 2,
        c: 44,
      });
  });

  it('have the expected methods', async () => {
    expect(Object.keys(storeCombined.actions)
      .sort())
      .toEqual(['doBoth', 'doubleC', 'incA', 'incB']);
  });

  it('should prefer the second incA', async () => {
    await storeCombined.actions.incA();
    expect(store.state)
      .toEqual({
        a: 1,
        b: 2,
      });
    expect(store2.state)
      .toEqual({
        a: 11,
        c: 44,
      });
    expect(storeCombined.state)
      .toEqual({
        a: 11,
        b: 2,
        c: 44,
      });
  });
});
