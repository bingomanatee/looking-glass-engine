import util from 'util';
import bottleFactory from '../bottle';

describe('looking-glass-engine', () => {
  let bottle;

  beforeEach(() => {
    bottle = bottleFactory();
  });

  describe('Store', () => {
    let Store;
    let STORE_STATE_UNSET_VALUE;
    let STORE_STATUS_NEW;
    let STORE_STATUS_STARTED;
    let STORE_STATUS_STARTING;
    let myStore;
    let log;

    beforeEach(() => {
      Store = bottle.container.Store;
      STORE_STATE_UNSET_VALUE = bottle.container.STORE_STATE_UNSET_VALUE;
      STORE_STATUS_NEW = bottle.container.STORE_STATUS_NEW;
      STORE_STATUS_STARTED = bottle.container.STORE_STATUS_STARTED;
      STORE_STATUS_STARTING = bottle.container.STORE_STATUS_STARTING;
    });

    describe('initialization', () => {
      describe('before start', () => {
        describe('no arguments', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            myStore = new Store();
          });
          it('should have a state of STORE_STATE_UNSET_VALUE', () => {
            expect(myStore.state).toEqual(STORE_STATE_UNSET_VALUE);
          });
          it('should have a status of STORE_STATUS_STARTED', () => {
            expect(myStore.status).toEqual(STORE_STATUS_STARTED);
          });
        });

        describe('state, no starter', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            myStore = new Store({ state: 1 });
          });
          it('should have a state of STORE_STATE_UNSET_VALUE', () => {
            expect(myStore.state).toEqual(1);
          });
          it('should have a status of STORE_STATUS_STARTED', () => {
            expect(myStore.status).toEqual(STORE_STATUS_STARTED);
          });
        });

        describe('starter(sync), no state', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            myStore = new Store({ starter: () => 1 });
          });
          it('should have a state of STORE_STATE_UNSET_VALUE', () => {
            expect(myStore.state).toEqual(STORE_STATE_UNSET_VALUE);
          });
          it('should have a status of STORE_STATUS_NEW', () => {
            expect(myStore.status).toEqual(STORE_STATUS_NEW);
          });
        });

        describe('starter(sync) and state', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            myStore = new Store({ starter: () => 2, state: 1 });
          });

          it('should have a state of STORE_STATE_UNSET_VALUE', () => {
            expect(myStore.state).toEqual(1);
          });

          it('should have a status of STORE_STATUS_NEW', () => {
            expect(myStore.status).toEqual(STORE_STATUS_NEW);
          });
        });
      });

      describe('after start', () => {
        describe('no arguments', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            myStore = new Store();
          });

          it('should have a state of STORE_STATE_UNSET_VALUE', () => {
            myStore.start();
            expect(myStore.state).toEqual(STORE_STATE_UNSET_VALUE);
          });

          it('should have a status of STORE_STATUS_STARTED', () => {
            myStore.start();
            expect(myStore.status).toEqual(STORE_STATUS_STARTED);
          });
        });

        describe('state, no starter', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            myStore = new Store({ state: 1 });
          });

          it('should have a state of STORE_STATE_UNSET_VALUE', () => {
            myStore.start();
            expect(myStore.state).toEqual(1);
          });

          it('should have a status of STORE_STATUS_STARTED', () => {
            myStore.start();
            expect(myStore.status).toEqual(STORE_STATUS_STARTED);
          });
        });

        describe('starter(sync), no state', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            log = [];
            myStore = new Store({ starter: () => 1, debug: true });
            myStore.debugStream.subscribe(m => log.push(m));
          });

          it('should have a state of 1', () => {
            log = [];
            myStore.start();
            expect(myStore.state).toEqual(1);
          });

          it('should have a status of STORE_STATUS_STARTED', () => {
            myStore.start();
            expect(myStore.status).toEqual(STORE_STATUS_STARTED);
          });
        });

        describe('starter(sync) and state', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            log = [];
            myStore = new Store({ starter: () => 1, state: -1, debug: true });
            myStore.debugStream.subscribe(m => log.push(m));
          });

          it('should have a state of 1', () => {
            myStore.start();
            // console.log('log:', util.inspect(log, { depth: 8 }));
            expect(myStore.state).toEqual(1);
          });

          it('should have a status of STORE_STATUS_STARTED', () => {
            myStore.start();
            expect(myStore.status).toEqual(STORE_STATUS_STARTED);
          });
        });

        describe('starter(async), no state', () => {
          beforeEach(() => {
            myStore = new Store({
              debug: true,
              starter: () => new Promise((done) => { setTimeout(() => done(2), 1000); }),
            });
            log = [];
            myStore.debugStream.subscribe(value => log.push(value));
          });

          it('should be in sync status STORE_STATUS_STARTING', async () => {
            myStore.start();
            expect(myStore.status).toEqual(STORE_STATUS_STARTING);
          });

          it('should have a sync state of STORE_STATE_UNSET_VALUE', async () => {
            myStore.start();

            expect(myStore.state).toEqual(STORE_STATE_UNSET_VALUE);
          });

          it('should resolve to STORE_STATUS_STARTED', async () => {
            await myStore.start();
            expect(myStore.status).toEqual(STORE_STATUS_STARTED);
          });

          it('should have an async state of 2', async () => {
            await myStore.start();

            expect(myStore.state).toEqual(2);
          });
        });
      });
    });

    describe('actions', () => {
      beforeEach(() => {
        myStore = new Store({
          state: { a: 1, b: [] },
          actions: {
            setA: ({ state }, a) => ({ ...state, a }),
            indirectSetA: ({ actions }, a) => {
              actions.setA(a);
              // note - no return value here
            },
            addAtoB: ({ state }) => Promise.resolve({ ...state, b: [...state.b, state.a] }),
          },
        });
      });

      it('should be in started status', () => {
        expect(myStore.status).toEqual(STORE_STATUS_STARTED);
      });

      describe('noop actions', () => {
        // a noop action is an action that has no return. aka, returns undefined, 'void'.

        it('should not matter if an action has no return', () => {
          myStore.actions.indirectSetA(10);
          expect(myStore.state).toEqual({ a: 10, b: [] });
        });
      });

      describe('sync actions', () => {
        it('should synchronously execute sync functions', () => {
          myStore.actions.setA(3);
          expect(myStore.state).toEqual({ a: 3, b: [] });
        });
      });

      describe('async actions', () => {
        it('should eventually execute async functions', async () => {
          const promise = myStore.actions.addAtoB();
          expect(myStore.state).toEqual({ a: 1, b: [] });
          await promise;
          expect(myStore.state).toEqual({ a: 1, b: [1] });
        });

        describe('multiple async stages', () => {
          // waterfall waits for a promise,
          // both promises resolutions are no-ops so shouldn't directly adjsut state;
          beforeEach(() => {
            myStore = new Store({
              state: { a: 1, b: [] },
              actions: {
                setA: ({ state }, a) => ({ ...state, a }),
                waterfall: store =>
                  new Promise((done) => {
                    setTimeout(() => {
                      store.actions.setA(store.state.a + 1);
                      done();
                    }, 100);
                  }).then(() => new Promise((done2) => {
                    setTimeout(() => {
                      store.actions.setA(store.state.a * 2);
                      done2();
                    }, 200);
                  })),
              },
            });
          });

          it('should only return after the second promise resolves', async () => {
            await myStore.actions.waterfall();
            expect(myStore.state.a).toEqual(4);
          });
        });
      });
    });
  });
});
