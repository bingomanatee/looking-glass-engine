import util from 'util';
import bottle from './../bottle';

describe('EngineMerger', () => {
  let Engine;
  let EngineMerger;
  let STORE_STATUS_NEW;
  let STORE_STATUS_INITIALIZED;
  let STORE_STATUS_INITIALIZING;
  let STORE_STATE_UNSET_VALUE;
  let engine1;
  let engine2;
  let engines;
  let debug;
  let actions;

  beforeEach(() => {
    const b = bottle();
    Engine = b.container.Engine;
    EngineMerger = b.container.EngineMerger;

    STORE_STATUS_NEW = b.container.STORE_STATUS_NEW;
    STORE_STATE_UNSET_VALUE = b.container.STORE_STATE_UNSET_VALUE;
    STORE_STATUS_INITIALIZING = b.container.STORE_STATUS_INITIALIZING;
    STORE_STATUS_INITIALIZED = b.container.STORE_STATUS_INITIALIZED;
    engine1 = new Engine({ state: { a: 1, b: 2 } }, {
      incA: () => state => Object.assign({}, state, { a: state.a + 1 }),
      incB: () => state => Object.assign({}, state, { b: state.b + 1 }),
    });

    engine2 = new Engine({ state: { a: 3, c: 4 } }, {
      incA: () => state => Object.assign({}, state, { a: state.a + 1 }),
      incC: () => state => Object.assign({}, state, { c: state.c + 1 }),
      pollActions: (combinedActions) => {
        actions = combinedActions;
        return (s => s);
      },
    });
  });

  describe('array of engines - sync initializers', () => {
    beforeEach(() => {
      engines = new EngineMerger({ engines: [engine1, engine2], debug: true });
      engines._debugStream.subscribe((...args) => {
        // console.log('debugMessage:', args);
      });
    });

    it('should only satisfy initialize after all the engines are initialized.', async () => {
      await engines.initialize();
      expect(engine1.state).toEqual({ a: 1, b: 2 });
      expect(engine2.state).toEqual({ a: 3, c: 4 });
    });

    it('should initialize then the component states should be set.', async () => {
      await engines.initialize();

      expect(engine1.status).toEqual(STORE_STATUS_INITIALIZED);
      expect(engine2.status).toEqual(STORE_STATUS_INITIALIZED);
    });

    it('should produce a merged state', async () => {
      await engines.initialize();
      expect(engines.state).toEqual({ a: 3, b: 2, c: 4 });
    });

    describe('.actions', () => {
      it('should produce combined actions', async () => {
        await engines.initialize();
        await engines.actions.pollActions();
        expect(Object.keys(actions).sort()).toEqual([
          'baseActions',
          'incA',
          'incB',
          'incC',
          'pollActions',
        ]);
        expect(Object.keys(actions.baseActions[0])).toEqual(['incA', 'incB']);
        expect(Object.keys(actions.baseActions[1])).toEqual(['incA', 'incC', 'pollActions']);
      });
    });

    describe('.states', () => {
      it('should express the states in array form', async () => {
        await (engines.initialize());
        expect(engines.states).toEqual([{ a: 1, b: 2 }, { a: 3, c: 4 }]);
      });
    });

    describe('.state', () => {
      it('should express the states in array form', async () => {
        await (engines.initialize());
        expect(engines.state).toEqual({ a: 3, b: 2, c: 4 });
      });
    });

    describe('actions', () => {
      it('should update merged state', async () => {
        await engines.initialize();
        await engines.actions.incA();

        expect(engines.state).toEqual({ a: 4, b: 2, c: 4 });
      });
    });
  });

  describe('object of engines - sync initializers', () => {
    beforeEach(() => {
      engines = new EngineMerger({
        engines: {
          engine1, engine2,
        },
      });
    });

    it('should only satisfy initialize after all the engines are intialized.', async () => {
      await engines.initialize();
      expect(engine1.state).toEqual({ a: 1, b: 2 });
      expect(engine2.state).toEqual({ a: 3, c: 4 });
    });

    it('should initialize then the component states should be set.', async () => {
      await engines.initialize();

      expect(engine1.status).toEqual(STORE_STATUS_INITIALIZED);
      expect(engine2.status).toEqual(STORE_STATUS_INITIALIZED);
    });

    it('should produce a merged state', async () => {
      await engines.initialize();
      expect(engines.state).toEqual({
        a: 3, b: 2, c: 4, engine1: { a: 1, b: 2 }, engine2: { a: 3, c: 4 },
      });
    });

    describe('.actions', () => {
      it('should produce combined actions', async () => {
        await engines.initialize();
        await engines.actions.pollActions();
        expect(Object.keys(actions).sort()).toEqual(['baseActions', 'engine1',
          'engine2', 'incA', 'incB', 'incC', 'pollActions']);
        expect(Object.keys(actions.baseActions.engine1)).toEqual(['incA', 'incB']);
        expect(Object.keys(actions.baseActions.engine2)).toEqual(['incA', 'incC', 'pollActions']);
      });
    });

    describe('.states', () => {
      it('should express the states in array form', async () => {
        await (engines.initialize());
        expect(engines.states).toEqual({ engine1: { a: 1, b: 2 }, engine2: { a: 3, c: 4 } });
      });
    });

    describe('.state', () => {
      it('should express the states in array form', async () => {
        await (engines.initialize());
        expect(engines.state).toEqual({
          a: 3, b: 2, c: 4, engine1: { a: 1, b: 2 }, engine2: { a: 3, c: 4 },
        });
      });
    });

    describe('actions', () => {
      it('should update merged state', async () => {
        await engines.initialize();
        await engines.actions.incA();

        expect(engines.state).toEqual({
          a: 4, b: 2, c: 4, engine1: { a: 1, b: 2 }, engine2: { a: 4, c: 4 },
        });
      });
    });
  });

  describe('object of engines - async initializers', () => {
    let e1debug;
    let e2debug;
    beforeEach(() => {
      e1debug = [];
      e2debug = [];
      engine1 = new Engine({
        id: 'slow engine',
        debug: true,
        state: { a: 0, b: 0 },
        initializer: () => new Promise((done) => {
          setTimeout(() => {
            done({ a: 1, b: 2 });
          }, 200);
        }),
      }, {
        incA: () => state => Object.assign({}, state, { a: state.a + 1 }),
        incB: () => state => Object.assign({}, state, { b: state.b + 1 }),
      });

      engine2 = new Engine({
        id: 'fast engine', debug: true, state: { a: 0, c: 0 }, initializer: () => Promise.resolve({ a: 3, c: 4 }),
      }, {
        incA: () => state => Object.assign({}, state, { a: state.a + 1 }),
        incC: () => state => Object.assign({}, state, { c: state.c + 1 }),
        pollActions: (combinedActions) => {
          actions = combinedActions;
          return (s => s);
        },
      });

      engine1._debugStream.subscribe(m => e1debug.push(m));
      engine2._debugStream.subscribe(m => e2debug.push(m));
    });

    it('should only satisfy initialize after all the engines are intialized.', async (

    ) => {
      expect.assertions(3);
      engines = new EngineMerger({
        debug: true,
        engines: {
          engine1, engine2,
        },
        maxWait: 500,
      });

      expect(engines.status).toEqual(STORE_STATUS_INITIALIZING);
      try {
        await engines.initialize();
        expect(engine1.state).toEqual({ a: 1, b: 2 });
        expect(engine2.state).toEqual({ a: 3, c: 4 });
      } catch (err) {
        console.log('error initializing: ', err);
      }
    });

  /*  it('should initialize then the component states should be set.', async () => {
      await engines.initialize();

      expect(engine1.status).toEqual(STORE_STATUS_INITIALIZED);
      expect(engine2.status).toEqual(STORE_STATUS_INITIALIZED);
    });

    it('should produce a merged state', async () => {
      await engines.initialize();
      expect(engines.state).toEqual({
        a: 3, b: 2, c: 4, engine1: { a: 1, b: 2 }, engine2: { a: 3, c: 4 },
      });
    });

    describe('.actions', () => {
      it('should produce combined actions', async () => {
        await engines.initialize();
        await engines.actions.pollActions();
        expect(Object.keys(actions).sort()).toEqual(['baseActions', 'engine1',
          'engine2', 'incA', 'incB', 'incC', 'pollActions']);
        expect(Object.keys(actions.baseActions.engine1)).toEqual(['incA', 'incB']);
        expect(Object.keys(actions.baseActions.engine2)).toEqual(['incA', 'incC', 'pollActions']);
      });
    });

    describe('.states', () => {
      it('should express the states in array form', async () => {
        await (engines.initialize());
        expect(engines.states).toEqual({ engine1: { a: 1, b: 2 }, engine2: { a: 3, c: 4 } });
      });
    });

    describe('.state', () => {
      it('should express the states in array form', async () => {
        await (engines.initialize());
        expect(engines.state).toEqual({
          a: 3, b: 2, c: 4, engine1: { a: 1, b: 2 }, engine2: { a: 3, c: 4 },
        });
      });
    });

    describe('actions', () => {
      it('should update merged state', async () => {
        await engines.initialize();
        await engines.actions.incA();

        expect(engines.state).toEqual({
          a: 4, b: 2, c: 4, engine1: { a: 1, b: 2 }, engine2: { a: 4, c: 4 },
        });
      });
    }); */
  });
});
