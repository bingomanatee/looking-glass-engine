import { combineLatest, BehaviorSubject, from } from 'rxjs';
import { map, distinctUntilChanged, pairwise, filter } from 'rxjs/operators';
import lGet from 'lodash.get';
import lClone from 'lodash.clonedeep';

export default (bottle) => {
  bottle.factory(
    'Store',
    ({
      STORE_STATE_UNSET_VALUE,
      STORE_STATUS_UNINITIALIZED,
      STORE_STATUS_INITIALIZING,
      STORE_STATUS_INITIALIZATION_ERROR,
      STORE_STATUS_INITIALIZED,
      NOT_SET,
      p, call,
      isPromise,
    }) => {
      class Store {
        constructor(props = null) {
          this._parseProps(props);

          this._initStateStream();
          this._initChangeStream();
          this._initErrorStream();

          this._initStream();


          if (this._debug) {
            this._initDebugStream();
          }

          this._setState(STORE_STATE_UNSET_VALUE);
          this._setStatus(STORE_STATUS_UNINITIALIZED);
        }

        _parseProps(props) {
          let initializer = null;
          let debug = false;
          let firstState = null;
          if (props) {
            if (typeof props === 'function') {
              initializer = props;
            } else if (typeof props === 'object') {
              if ('state' in props || 'initializer' in props) {
                initializer = lGet(props, 'initializer');
                firstState = lGet(props, 'state', STORE_STATE_UNSET_VALUE);
                debug = lGet(props, 'debug', false);
              } else {
                firstState = props;
              }
            } else {
              firstState = props;
            }
          }
          this._firstState = firstState;
          this._initializer = initializer;
          this._debug = debug;
        }

        _initStateStream() {
          this._stateStream = new BehaviorSubject(STORE_STATE_UNSET_VALUE)
            .pipe(distinctUntilChanged());
          this._stateStream.subscribe((next) => {
            this._state = next;
          });
        }

        _initErrorStream() {
          this._errorStream = new BehaviorSubject()
            .pipe(distinctUntilChanged());
          this._errorStream.subscribe((next) => {
            this._error = next;
          });
        }

        _initDebugStream() {
          this._debugStream = new BehaviorSubject()
            .pipe(distinctUntilChanged());
          this._errorStream.subscribe((message) => {
            this._debugStream.next({
              source: '(errorStream)',
              message,
            });
          });

          this._changeStream.subscribe((message) => {
            this._debugStream.next({
              source: '(changeStream)',
              message,
            });
          });

          this._stateStream.subscribe((message) => {
            this._debugStream.next({
              source: '(stateStream)',
              message,
            });
          });
        }

        _initStream() {
          this._stream = combineLatest(this._stateStream, this._statusStream)
            .pipe(map(([streamedState, streamedStatus]) => ({
              state: streamedState,
              status: streamedStatus,
            })), distinctUntilChanged());
        }

        _resolveChangePromise(params) {
          const {
            change,
            fail = NOT_SET,
          } = params;

          this._debugMessage('change stream', 'is promise', params);
          change
            .then((newChange) => {
              this._changeStream.next({
                ...params,
                change: newChange,
              });
            })
            .catch((error) => {
              call(fail, error);
              this._errorStream.next({
                ...params,
                error,
              });
            });
        }

        _resolveChangeFunction(params) {
          const { change } = params;

          this._debugMessage('change stream', 'is function', params);
          try {
            this._changeStream.next({
              ...params,
              change: change(this.state, this),
            });
          } catch (error) {
            this._changeError(error, params);
          }
        }

        _changeError(error, params) {
          const {
            fail = NOT_SET,
          } = params;

          this._debugMessage('change stream', 'is error', { ...params, error });

          call(fail, error, params);
          this._errorStream.next({
            ...params,
            error,
          });
        }

        _initChangeStream() {
          this._changeStream = new BehaviorSubject(NOT_SET);
          this._changeStream.subscribe((params) => {
            if (params === NOT_SET) return;

            this._debugMessage('change stream listener', '(initial)', params);
            const {
              change = NOT_SET,
              done = NOT_SET,
              fail = NOT_SET,
              status = NOT_SET,
            } = params;

            if (this.isInitializeError) {
              call(fail, this.initializationError);
            } else if (!change) {
              const error = new Error('no change specified');
              this._changeError(error, params);
            } else if (isPromise(change)) {
              this._resolveChangePromise(params);
            } else if (typeof change === 'function') {
              this._resolveChangeFunction(params);
            } else if (!this.isInitialized) {
              if (status === NOT_SET) {
                // until status is updated changes are buffered
                this._debugMessage('change stream', 'delaying execution until initializing is done', params);
                this.onInit(() => {
                  this._debugMessage('change stream', 'delayed execution', params);
                  this._changeStream.next(params);
                });
              } else {
                this._debugMessage('change stream', 'doing change status', params);
                this._setState(change);
                this._setStatus(status);
                call(done, this.state);
              }
            } else {
              this._debugMessage('change stream', 'syncronous change', params);
              this._setState(change);
              if (status) this._setStatus(status);
              call(done, this.state);
            }
          }, (error) => {
            this._errorStream.next({
              message: 'change stream error',
              error,
            });
          });
        }
        _debugMessage(source, message, params) {
          if (this._debug) {
            this._debugStream.next({
              source,
              message,
              params,
              store_state: this.state,
              store_status: this.status,
            });
          }
        }


        change(stateChange, status = NOT_SET, onError = NOT_SET) {
          let myResolve = NOT_SET;
          let myFail = NOT_SET;
          const promise = new Promise((resolve, fail) => {
            myResolve = resolve;
            myFail = fail;
          });
          const params = {
            change: stateChange,
            status,
            done: myResolve,
            fail: (error) => {
              call(onError, error);
              myFail(error);
            },
          };

          this._changeStream.next(params);
          return promise;
        }

        get state() {
          return this._state;
        }

        _setState(value) {
          this._stateStream.next(value);
        }

        get status() {
          return this._status;
        }

        _setStatus(status) {
          this._status = status;
        }

        subscribe(...args) {
          this._stream.subscribe(...args);
        }

        get isInitializing() {
          return this.status === STORE_STATUS_INITIALIZING;
        }

        get isNotUninitialized() {
          return this.isInitialized || this.isInitializeError;
        }

        get isInitialized() {
          return (this.status === STORE_STATUS_INITIALIZED);
        }

        get isInitializeError() {
          return (this.status === STORE_STATUS_INITIALIZATION_ERROR);
        }

        initialize() {
          if (this._initPromise) return this._initPromise;

          if (this._initialState) {
            if (this._initializer) {
              this.change(this._initialState, STORE_STATUS_INITIALIZING);
              this._initPromise = this.change(this._initializer, STORE_STATUS_INITIALIZED);
            } else {
              this._initPromise = this.change(this._initialState, STORE_STATUS_INITIALIZED);
            }
          } else if (this._initializer) {
            this._initPromise = this.change(this._initializer, STORE_STATUS_INITIALIZED);
          }
          return this._initPromise;
        }

        onInit(fn, onError) {
          if (this.isInitializeError) {
            call(onError, this.initializationError);
          } else if (this.isInitialized) {
            fn(this);
          } else {
            const sub = this._statusStream.subscribe(
              (status) => {
                switch (status) {
                  case STORE_STATUS_INITIALIZED:
                    sub.unsubscribe();
                    fn(this);
                    break;

                  case STORE_STATUS_INITIALIZATION_ERROR:
                    call(onError, this.initializationError, this);
                    break;

                  default:
                }
              },
              (error) => {
                onError(error, this);
              },
            );
          }
        }
      }

      return Store;
    },
  );
};
