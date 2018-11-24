import { combineLatest, BehaviorSubject } from 'rxjs';
import { map, pairwise, filter } from 'rxjs/operators';
import lGet from 'lodash.get';
import lClone from 'lodash.clonedeep';

export default (bottle) => {
  bottle.factory(
    'Store',
    ({
      BASE_STATE_UNINITIALIZED_VALUE,
      BASE_STATE_STATUS_UNINITIALIZED,
      BASE_STATE_STATUS_INITIALIZING,
      BASE_STATE_STATUS_INITIALIZATION_ERROR,
      BASE_STATE_STATUS_INITIALIZED,
      p,
    }) => {
      class Store {
        constructor(props = null) {
          let state = BASE_STATE_UNINITIALIZED_VALUE;
          let initializer = null;
          if (props) {
            if (typeof props === 'function') {
              initializer = props;
            } else if (typeof props === 'object') {
              if ('state' in props || 'initializer' in props) {
                initializer = lGet(props, 'initializer');
                state = lGet(props, 'state', BASE_STATE_UNINITIALIZED_VALUE);
              } else {
                state = props;
              }
            } else {
              state = props;
            }
          }

          this._stateStream = new BehaviorSubject();
          this._stateStream.subscribe((next) => {
            this._state = next;
          });

          this._statusStream = new BehaviorSubject();
          this._statusStream.subscribe((next) => {
            this._status = next;
          });

          this._stream = combineLatest(this._stateStream, this._statusStream)
          // eslint-disable-next-line no-shadow
            .pipe(map(([state, status]) => ({
              state,
              status,
            })));

          this._statusStream.next(BASE_STATE_STATUS_UNINITIALIZED);
          this.state = lClone(state);

          if (initializer) {
            if (typeof initializer !== 'function') {
              throw new Error('bad initializer', initializer);
            }
            this._initializer = initializer;
          }
        }

        get state() {
          return this._state;
        }

        set state(value) {
          this._stateStream.next(value);
        }

        get status() {
          return this._status;
        }

        subscribe(...args) {
          this._stream.subscribe(...args);
        }

        initialize() {
          if (!this._initPromise) {
            this._initPromise = new Promise(async (resolve, reject) => {
              if (!this._initializer) {
                if (this.state !== BASE_STATE_STATUS_INITIALIZED) {
                  this._statusStream.next(BASE_STATE_STATUS_INITIALIZED);
                }
                resolve();
                return;
              } else if (this.state === BASE_STATE_STATUS_INITIALIZED) {
                resolve();
                return;
              }
              this._statusStream.next(BASE_STATE_STATUS_INITIALIZING);
              const [state, error] = await p(this._initializer, this);
              if (error) {
                this.initializionError = error;
                this._statusStream.next(BASE_STATE_STATUS_INITIALIZATION_ERROR);
                reject(error);
              } else {
                this.state = state;
                this._statusStream.next(BASE_STATE_STATUS_INITIALIZED);
                resolve();
              }
            });
          }
          return this._initPromise;
        }
      }

      return Store;
    },
  );
};
