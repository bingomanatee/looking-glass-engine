/* eslint-disable no-return-assign,consistent-return */
import lGet from 'lodash.get';
import { combineLatest, from } from 'rxjs';
import { map } from 'rxjs/operators';

export default (bottle) => {
  bottle.factory(
    'StoreEngineReducer',
    ({
      p, isPromise, Store,
      STORE_UNINITIALIZED_VALUE,
      STORE_STATUS_INITIALIZATION_ERROR,
      STORE_STATUS_INITIALIZED,
      STORE_STATUS_INITIALIZING,
    }) => {
      const defaultActionReducer = ({ engines }) => {
        const localEngines = [...engines];
        const first = localEngines.shift();

        return localEngines.reduce((memo, engine) => {
          const actions = { ...memo };
          Object.keys(engine.mutators)
            .forEach((name) => {
              actions[name] = async (...params) => engine.perform({
                name,
                actions,
                params,
              });
            });

          return actions;
        }, first.actions);
      };

      const defaultStateReducer = (memo, state) => {
        if (memo === STORE_UNINITIALIZED_VALUE) {
          return state;
        } else if (state === STORE_UNINITIALIZED_VALUE) {
          return memo;
        }
        if (typeof memo === 'object') {
          if (typeof state === 'object') {
            return { ...memo, ...state };
          }
          // eslint-disable-next-line no-console
          console.log('non-object state:', state);
          return state;
        }
        return state;
      };

      class StoreEngineReducer extends Store {
        constructor(engines, props = {}) {
          super({ initialState: STORE_UNINITIALIZED_VALUE });
          this.engines = engines;
          this._stateReducer = lGet(props, 'stateReducer', defaultStateReducer);
          this._actionReducer = lGet(props, 'actionReducer', defaultActionReducer);

          const engineStreams = engines.map(e => e._stateStream);
          const self = this;
          this._combinedStateStreams = combineLatest(...engineStreams)
            .pipe(map(states => states.reduce(self._stateReducer, {})));
          this._combinedStateStreams.subscribe((state) => {
            this.state = state;
          });
          this.actions = this._actionReducer(this);
        }

        initialize() {
          if (this._initPromise) return this._initPromise;
          if (this.isInitialized) {
            return true;
          }

          this.engines.map(engine => engine.initialize());

          this._setStatus(this.engines.reduce((status, engine) => {
            if (!status) return engine.status;
            let statuses
            if (status !== STORE_STATUS_INITIALIZED) return status;
            return engine.status;
          }, null));

          if (this.status === STORE_STATUS_INITIALIZING) {
            this._initPromise = new Promise((resolve, reject) => {
              let initialized = 0;
              let done = false;
              this.engines.forEach((engine) => {
                engine.onInit(
                  () => {
                    if (done) return;
                    initialized += 1;
                    if (initialized.length === this.engines.length) {
                      done = true;
                      this._initPromise = null;
                      this._setStatus(STORE_STATUS_INITIALIZED);
                      resolve();
                    }
                  },
                  (error) => {
                    if (done) return;
                    done = true;
                    this._setStatus(STORE_STATUS_INITIALIZATION_ERROR);
                    this.initializationError = error;
                    reject(error);
                  },
                );
              });
            });
          }
        }
      }

      return StoreEngineReducer;
    },
  );
};
