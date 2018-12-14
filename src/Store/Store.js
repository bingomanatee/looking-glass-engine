import { combineLatest, BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
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
      isPromise,
    }) => {
      class Store {
        constructor(props = null) {
          const { state, initializer } = this._parseProps(props);
          this._initStateStream();
          this._initStatusStream();

          this._stream = combineLatest(this._stateStream, this._statusStream)
            .pipe(map(([streamedState, streamedStatus]) => ({
              state: streamedState,
              status: streamedStatus,
            })), distinctUntilChanged());

          this.state = state || BASE_STATE_UNINITIALIZED_VALUE;

          this._statusStream.next(BASE_STATE_STATUS_UNINITIALIZED);

          this._initializer = initializer;
        }

        _parseProps(props) {
          let initializer = null;
          let state = BASE_STATE_UNINITIALIZED_VALUE;
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
          return {
            state,
            initializer,
          };
        }

        _initStatusStream() {
          this._statusStream = new BehaviorSubject(BASE_STATE_STATUS_UNINITIALIZED);
          this._statusStream.subscribe((next) => {
            this._status = next;
          });
        }

        _initStateStream() {
          this._stateStream = new BehaviorSubject(BASE_STATE_UNINITIALIZED_VALUE);
          this._stateStream.subscribe((next) => {
            this._state = next;
          });
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


        get isInitialized() {
          return (this.status === BASE_STATE_STATUS_INITIALIZED);
        }

        get isInitializeError() {
          return (this.status === BASE_STATE_STATUS_INITIALIZATION_ERROR);
        }

        /**
         * executes the _initialize function if it exists.
         * this is a "quasi-asynchronous process.
         *
         * -- if the state has been initialized it returns true.
         * -- if _initializer doesn't exist it returns true.
         * -- if _initializer is synchronous (and not run already) it sets state to its output
         *    and returns true.
         * -- if _initilizer returns a promise it returns that promise chained with
         *    capturing the output and returning true from that promise.
         *
         * so it can be both a synchrnous or asynchronous process.
         *
         * if this is too much (yes) use onInit() to ensure your action
         * executes after state is initialized.
         *
         * @returns {boolean || Promise}
         */
        initialize() {
          if (this._initPromise) return this._initPromise;
          if (this.isInitialized) return true;
          if (this.isInitializeError) return false;

          this._statusStream.next(BASE_STATE_STATUS_INITIALIZING);
          if (this._initializer) {
            const resultOfInitializer = this._initializer();
            if (isPromise(resultOfInitializer)) {
              this._initPromise = resultOfInitializer.then((value) => {
                this.state = value;
                this._statusStream.next(BASE_STATE_STATUS_INITIALIZED);
                this._initPromise = false;
                return true;
              })
                .catch((err) => {
                  this.initializationError = err;
                  this._initPromise = false;
                  return false;
                });
              return this._initPromise;
            }
            this.state = resultOfInitializer;
          }
          this._statusStream.next(BASE_STATE_STATUS_INITIALIZED);
          return true;
        }

        onInit(fn, onError) {
          if (this.isInitialized) {
            return fn(this);
          }
          if (this.isInitializeError) return onError(this, this.initializationError);
          const init = this.initialize();
          if (init === true) {
            return fn(this);
          }
          if (init === false) {
            return onError(this, this.initializationError);
          }
          if (isPromise(init)) {
            init.then(() => fn(this))
              .catch(() => onError(this.initializationError));
          }
        }
      }

      return Store;
    },
  );
};
