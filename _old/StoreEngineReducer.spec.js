import bottle from './../bottle';

describe('StoreEngineReducer', () => {
  let StoreEngine;
  let StoreEngineReducer;
  let STORE_STATUS_UNINITIALIZED;
  let STORE_STATUS_INITIALIZED;
  let STORE_STATUS_INITIALIZING;
  let STORE_UNINITIALIZED_VALUE;
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
    STORE_STATUS_UNINITIALIZED = b.container.STORE_STATUS_UNINITIALIZED;
    STORE_UNINITIALIZED_VALUE = b.container.STORE_UNINITIALIZED_VALUE;
    STORE_STATUS_INITIALIZING = b.container.STORE_STATUS_INITIALIZING;
    STORE_STATUS_INITIALIZED = b.container.STORE_STATUS_INITIALIZED;
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
      doBoth: async (actions) => {
        await actions.incA();
        await actions.incB();
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

  describe('custom reduction', () => {
    let engineAlpha;
    let engineBeta;
    let blend;

    beforeEach(async () => {
      engineAlpha = new StoreEngine(
        {
          a: 1,
          b: 2,
          c: 3,
        },
        {
          setA: update((actions, a) => () => ({ a })),
          setB: update((actions, b) => () => ({ b })),
          addAtoB: () => (state) => {
            const { a, b } = state;
            return Object.assign({}, state, { b: a + b });
          },
        },
      );

      engineAlpha.name = 'alpha';

      engineBeta = new StoreEngine({
        a: 10,
        c: 20,
        d: 30,
      }, {
        setA: update((actions, a) => () => ({ a })),
        addAllToD: () => ({ a, c, d }) => {
          const sum = a + c + d;
          return Object.assign({}, {
            a,
            c,
            d: sum,
          });
        },
      });

      engineBeta.name = 'beta';

      blend = new StoreEngineReducer([engineAlpha, engineBeta], {
        stateReducer: (memo, state, i) => {
          const out = { ...memo };
          const keys = Object.keys(state);
          switch (i) {
            case 0:
              keys.forEach((name) => {
                out[`${name}-alpha`] = state[name];
              });
              break;

            case 1:
              keys.forEach((name) => {
                out[`${name}-beta`] = state[name];
              });
              break;

            default:
          }
          return out;
        },

        actionReducer: ({ engines }) => engines.reduce((actions, engine) => {
          const out = { ...actions };
          const keys = Object.keys(engine.actions);

          keys.forEach((name) => {
            out[`${name}_${engine.name}`] = engine.actions[name];
          });

          return out;
        }, {}),
      });

      await (blend.initialize());
    });

    it('should blend the states differentiated by name', () => {
      expect(blend.state)
        .toEqual({
          'a-alpha': 1,
          'a-beta': 10,
          'b-alpha': 2,
          'c-alpha': 3,
          'c-beta': 20,
          'd-beta': 30,
        });
    });

    it('should update the blended state properly', async () => {
      await blend.actions.setA_alpha(1000);
      await blend.actions.setA_beta(2000);

      expect(blend.state).toEqual({
        'a-alpha': 1000,
        'a-beta': 2000,
        'b-alpha': 2,
        'c-alpha': 3,
        'c-beta': 20,
        'd-beta': 30,
      });
    });
  });
});
