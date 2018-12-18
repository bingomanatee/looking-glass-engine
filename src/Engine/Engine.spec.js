
import bottle from './../bottle';

describe('Engine', () => {
  let Engine;
  let STORE_STATUS_NEW;
  let STORE_STATUS_INITIALIZED;
  let STORE_STATUS_INITIALIZING;
  let STORE_STATE_UNSET_VALUE;

  beforeEach(() => {
    const b = bottle();
    Engine = b.container.Engine;
    STORE_STATUS_NEW = b.container.STORE_STATUS_NEW;
    STORE_STATE_UNSET_VALUE = b.container.STORE_STATE_UNSET_VALUE;
    STORE_STATUS_INITIALIZING = b.container.STORE_STATUS_INITIALIZING;
    STORE_STATUS_INITIALIZED = b.container.STORE_STATUS_INITIALIZED;
  });

  describe('allowing chaining of actions before init', () => {
    let engine;
    let debug;
    let actions;
    describe('before initialize', () => {
      beforeEach(() => {
        debug = [];
        actions = [];
        engine = new Engine({ state: { a: 1, b: 1 }, debug: true }, {
          incA: () => store => Object.assign({}, store, { a: store.a + 1 }),
          incB: () => Promise.resolve(store => Object.assign({}, store, { b: store.b + 1 })),
          doBoth: async ({ incA, incB }) => {
            await incA();
            await incB();
            return state => state;
          },
        });
        engine._debugStream.subscribe((value) => {
          debug.push(value);
        });

        engine.actionStream.subscribe((value) => {
          actions.push(value);
        });
      });
      it('increments (sync)', () => {
        engine.actions.incA();
        console.log('actions:', actions);
        console.log('debug:', debug);
        expect(engine.state).toEqual({ a: 2, b: 1 });
      });

      it('increments(async)', async () => {
        try {
          await engine.actions.incB();
          expect(engine.state).toEqual({a: 1, b: 2});
        } catch (err) {
          console.log('error:', err);
        }
      });

      it('can call inner actions', async () => {
        await engine.actions.doBoth();
        expect(engine.state).toEqual({ a: 2, b: 2 });
      });
    });
  });
});
