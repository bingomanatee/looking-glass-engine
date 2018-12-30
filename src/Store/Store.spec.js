import bottleFactory from '../bottle';
import util from 'util';

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

    beforeEach(() => {
      Store = bottle.container.Store;
      STORE_STATE_UNSET_VALUE = bottle.container.STORE_STATE_UNSET_VALUE;
      STORE_STATUS_NEW = bottle.container.STORE_STATUS_NEW;
      STORE_STATUS_STARTED = bottle.container.STORE_STATUS_STARTED;
      STORE_STATUS_STARTING = bottle.container.STORE_STATUS_STARTING;
    });

    describe('initialization', () => {
      let myStore;
      let log;
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
            // console.log('before start: log', util.inspect(log, { depth: 8 }));
            // log = [];
            const promise = myStore.start();
            // console.log('after start: log', util.inspect(log, { depth: 8 }));
            expect(myStore.status).toEqual(STORE_STATUS_STARTING);
          });

          it('should have a sync state of STORE_STATE_UNSET_VALUE', async () => {
            const promise = myStore.start();

            expect(myStore.state).toEqual(STORE_STATE_UNSET_VALUE);
          });

          it('should resolve to STORE_STATUS_STARTED', async () => {
            // console.log('before start: log', util.inspect(log, { depth: 8 }));
            // log = [];
            await myStore.start();
            // console.log('after start: log', util.inspect(log, { depth: 8 }));
            expect(myStore.status).toEqual(STORE_STATUS_STARTED);
          });

          it('should have a sync state of STORE_STATE_UNSET_VALUE', async () => {
            await myStore.start();

            expect(myStore.state).toEqual(2);
          });
        });
      });
    });
  });
});
