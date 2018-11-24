import lGet from 'lodash.get';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

export default (bottle) => {
  bottle.factory(
    'StoreEngineReducer',
    ({
      p,
      Store,
      BASE_STATE_UNINITIALIZED_VALUE,
      BASE_STATE_STATUS_INITIALIZATION_ERROR,
      BASE_STATE_STATUS_INITIALIZED,
    }) => {
      const defaultActionReducer = (memo, engine) => ({ ...memo, ...engine.actions });

      const defaultStateReducer = (memo, state) => {
        if (memo === BASE_STATE_UNINITIALIZED_VALUE) {
          return state;
        } else if (state === BASE_STATE_UNINITIALIZED_VALUE) {
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
          super({ initialState: BASE_STATE_UNINITIALIZED_VALUE });
          this.engines = engines;
          this._stateReducer = lGet(props, 'storeReducer', defaultStateReducer);
          this._actionReducer = lGet(props, 'actionReducer', defaultActionReducer);

          const engineStreams = engines.map(e => e._stateStream);
          const self = this;
          this._combinedStateStreams = combineLatest(...engineStreams)
            .pipe(map(states => states.reduce(self._stateReducer, {})));
          this._combinedStateStreams.subscribe((state) => {
            this.state = state;
          });
          this.actions = engines.reduce(this._actionReducer, {});
          Object.keys(this.actions)
            .forEach((actionName) => {
              const action = this.actions[actionName];
              this.actions[actionName] = async (...args) => {
                await this.initialize();
                return action(...args);
              };
            });
        }

        initialize() {
          if (!this._initializePromise) {
            this._initializePromise = new Promise(async (resolve, reject) => {
              const [_, error] = await p(Promise.all(this.engines.map(engine => engine.initialize())));
              if (error) {
                this._statusStream.next(BASE_STATE_STATUS_INITIALIZATION_ERROR);
                reject();
              } else {
                this._statusStream.next(BASE_STATE_STATUS_INITIALIZED);
                resolve();
              }
            });
          }

          return this._initializePromise;
        }
      }

      return StoreEngineReducer;
    },
  );
};
