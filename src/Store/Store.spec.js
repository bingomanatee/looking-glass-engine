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
    let S_NEW;
    let S_STARTED;
    let S_STARTING;
    let S_ERROR;
    let myStore;
    let log;

    beforeEach(() => {
      Store = bottle.container.Store;
      STORE_STATE_UNSET_VALUE = bottle.container.STORE_STATE_UNSET_VALUE;
      S_NEW = bottle.container.S_NEW;
      S_STARTED = bottle.container.S_STARTED;
      S_STARTING = bottle.container.S_STARTING;
      S_ERROR = bottle.container.S_ERROR;
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
          it('should have a state of empty object', () => {
            expect(myStore.state).toEqual({});
          });
          it('should have a status of S_STARTED', () => {
            expect(myStore.status).toEqual(S_STARTED);
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
          it('should have a status of S_STARTED', () => {
            expect(myStore.status).toEqual(S_STARTED);
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
          it('should have a status of S_NEW', () => {
            expect(myStore.status).toEqual(S_NEW);
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

          it('should have a status of S_NEW', () => {
            expect(myStore.status).toEqual(S_NEW);
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

          it('should have a state of empty object', () => {
            myStore.start();
            expect(myStore.state).toEqual({});
          });

          it('should have a status of S_STARTED', () => {
            myStore.start();
            expect(myStore.status).toEqual(S_STARTED);
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

          it('should have a status of S_STARTED', () => {
            myStore.start();
            expect(myStore.status).toEqual(S_STARTED);
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

          it('should have a status of S_STARTED', () => {
            myStore.start();
            expect(myStore.status).toEqual(S_STARTED);
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
            // console._log('_log:', util.inspect(_log, { depth: 8 }));
            expect(myStore.state).toEqual(1);
          });

          it('should have a status of S_STARTED', () => {
            myStore.start();
            expect(myStore.status).toEqual(S_STARTED);
          });
        });

        describe('starter(sync) and state -- error on starter', () => {
          /**
           * without either a state or initializer, the state is as initialized
           * as it ever will be -- to an unset symbol flag.
           */

          beforeEach(() => {
            log = [];
            myStore = new Store({
              starter: () => {
                throw new Error('I have an error');
              },
              state: -1,
              debug: true,
            });
            myStore.debugStream.subscribe(m => log.push(m));
          });

          it('should have a state of -1', () => {
            expect.assertions(1);
            myStore.start()
              .catch(() => {
                expect(myStore.state).toEqual(-1);
              });
          });

          it('should have a status of S_ERROR', () => {
            expect.assertions(1);
            myStore.start()
              .catch(() => {
                expect(myStore.status).toEqual(S_ERROR);
              });
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

          it('should be in sync status S_STARTING', async () => {
            myStore.start();
            expect(myStore.status).toEqual(S_STARTING);
          });

          it('should have a sync state of STORE_STATE_UNSET_VALUE', async () => {
            myStore.start();

            expect(myStore.state).toEqual(STORE_STATE_UNSET_VALUE);
          });

          it('should _resolve to S_STARTED', async () => {
            await myStore.start();
            expect(myStore.status).toEqual(S_STARTED);
          });

          it('should have an async state of 2', async () => {
            await myStore.start();

            expect(myStore.state).toEqual(2);
          });
        });
      });

      describe('property based states', () => {
        beforeEach(() => {
          myStore = new Store({ state: {} })
            .addProp('name', {
              type: 'string',
              start: '',
              valueIfTestFails: '',
              test: (name) => {
                if (typeof name !== 'string') return 'name must be string';
                if (!/^[\w]+$/.test(name)) return 'name can only contain letters - no symbols/spaces';
                return false;
              },
            })
            .addProp('heightInInches', {
              type: 'number',
              start: 5.5 * 12,
              valueIfTestFails: 0,
              test: (h) => {
                if (typeof h !== 'number') return 'height must be a number';
                if (h <= 0) return 'height must be a positive number';
                if (h > 8 * 12) return 'come on man';
                return false;
              },
            });
        });

        it('should have default values in store', () => {
          expect(myStore.status).toBe(S_STARTED);
          expect(myStore.state).toEqual({ heightInInches: 66, name: '' });
        });

        it('should have setters', () => {
          myStore.do.setName('Bob');
          expect(myStore.state).toEqual({ heightInInches: 66, name: 'Bob' });

          myStore.do.setHeightInInches(100);
          expect(myStore.state).toEqual({ heightInInches: 100, name: 'Bob' });
        });

        it('should accept invalid values', () => {
          myStore.do.setName('$robotMan');
          expect(myStore.state).toEqual({ heightInInches: 66, name: '$robotMan' });
        });


        it('should communicate no errors after valid value set', () => {
          myStore.do.setName('Bob');
          myStore.do.setHeightInInches(12 * 6);
          const { state, errors } = myStore.stateAndErrors;

          expect(state).toEqual(myStore.state);
          expect(errors).toBeFalsy();
        });

        it('should communicate errors after invalid value set', () => {
          myStore.do.setName('$robotName');
          myStore.do.setHeightInInches(-5);
          const { state, errors } = myStore.stateAndErrors;

          expect(state).toEqual({ name: '', heightInInches: 0 });
          expect(errors).toEqual({
            heightInInches: 'height must be a positive number',
            name: 'name can only contain letters - no symbols/spaces',
          });
        });
      });
    });

    describe('do', () => {
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
        expect(myStore.status).toEqual(S_STARTED);
      });

      describe('noop do', () => {
        // a noop action is an action that has no return. aka, returns undefined, 'void'.

        it('should not matter if an action has no return', () => {
          myStore.do.indirectSetA(10);
          expect(myStore.state).toEqual({ a: 10, b: [] });
        });
      });

      describe('sync do', () => {
        it('should synchronously execute sync functions', () => {
          myStore.do.setA(3);
          expect(myStore.state).toEqual({ a: 3, b: [] });
        });
      });

      describe('async do', () => {
        it('should eventually execute async functions', async () => {
          const promise = myStore.do.addAtoB();
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
                      store.do.setA(store.state.a + 1);
                      done();
                    }, 100);
                  }).then(() => new Promise((done2) => {
                    setTimeout(() => {
                      store.do.setA(store.state.a * 2);
                      done2();
                    }, 200);
                  })),
              },
            });
          });

          it('should only return after the second promise resolves', async () => {
            await myStore.do.waterfall();
            expect(myStore.state.a).toEqual(4);
          });
        });
      });

      describe('noop do', () => {
        beforeEach(() => {
          /**
           * this action changes a through sub-actions.
           * it has a return value that for whatever reason we do NOT
           * want put into state. Because of this we speciically mark it as noop.
           */
          myStore.addAction('doubleA', ({ state, actions }) => {
            const { a } = state;
            actions.setA(2 * a);
            return 100;
          }, { noop: true });
        });

        it('suppresses action return value', () => {
          myStore.do.doubleA();
          expect(myStore.state).toEqual({ a: 2, b: [] });
        });
      });
    });
  });
});
