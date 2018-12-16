import { combineLatest, BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged, pairwise, filter } from 'rxjs/operators';
import lGet from 'lodash.get';
import lClone from 'lodash.clonedeep';

export default (bottle) => {
  bottle.factory(
    'Store',
    ({
      STORE_UNINITIALIZED_VALUE,
      STORE_STATUS_UNINITIALIZED,
      STORE_STATUS_INITIALIZING,
      STORE_STATUS_INITIALIZATION_ERROR,
      STORE_STATUS_INITIALIZED,
      p,
      isPromise,
    }) => {
      class Store {
        constructor(props = null) {
          const { state, initializer, debug } = this._parseProps(props);
          this._debug = debug;
          this._initialState = state;
          this._initializer = initializer;

          this._initStateStream();
          this._initStatusStream();
          this._initStream();

          this.state = STORE_UNINITIALIZED_VALUE;

          this._setStatus(); // to prime pairwise _stream
          this._setStatus(STORE_STATUS_UNINITIALIZED);
        }

        _parseProps(props) {
          let initializer = null;
          let debug = false;
          let state = null;
          if (props) {
            if (typeof props === 'function') {
              initializer = props;
            } else if (typeof props === 'object') {
              if ('state' in props || 'initializer' in props) {
                initializer = lGet(props, 'initializer');
                state = lGet(props, 'state', STORE_UNINITIALIZED_VALUE);
                debug = lGet(props, 'debug'.false);
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
            debug,
          };
        }

        _initStream() {
          this._stream = this._stateStream
            .pipe(
              map(state => ({
                state,
                status: this.status,
              })),
              distinctUntilChanged(),
            );
        }

        _initStatusStream() {
          this._statusStream = new BehaviorSubject(STORE_STATUS_UNINITIALIZED)
            .pipe(distinctUntilChanged());
          this._statusStream.subscribe((next) => {
            this._status = next;
          });
        }

        _initStateStream() {
          this._stateStream = new BehaviorSubject(STORE_UNINITIALIZED_VALUE)
            .pipe(distinctUntilChanged());
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

        _setStatus(status) {
          this._statusStream.next(status);
        }

        subscribe(...args) {
          this._stream.subscribe(...args);
        }


        get isInitialized() {
          return (this.status === STORE_STATUS_INITIALIZED) || this.isInitializeError;
        }

        get isInitializeError() {
          return (this.status === STORE_STATUS_INITIALIZATION_ERROR);
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

          this._setStatus(STORE_STATUS_INITIALIZING);
          if (this._initializer) {
            const resultOfInitializer = this._initializer();
            if (isPromise(resultOfInitializer)) {
              this._initPromise = resultOfInitializer.then((value) => {
                this.state = value;
                this._setStatus(STORE_STATUS_INITIALIZED);
                this._initPromise = false;
                return true;
              })
                .catch((err) => {
                  this.initializationError = err;
                  this.this.initializationError(STORE_STATUS_INITIALIZATION_ERROR);
                  this._initPromise = false;
                  return false;
                });
              return this._initPromise;
            }
            this.state = resultOfInitializer;
          } else if (this._initialState) {
            this.state = this._initialState;
          }
          this._setStatus(STORE_STATUS_INITIALIZED);
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
