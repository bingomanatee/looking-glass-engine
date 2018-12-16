/* eslint-disable no-unreachable */
import { combineLatest, BehaviorSubject, from } from 'rxjs';
import { map, distinctUntilChanged, pairwise, filter } from 'rxjs/operators';
import lGet from 'lodash.get';
import lClone from 'lodash.clonedeep';

export default (bottle) => {
  bottle.factory(
    'Store',
    ({
      STORE_STATE_UNSET_VALUE,
      STORE_STATUS_NEW,
      STORE_STATUS_INITIALIZING,
      STORE_STATUS_INITIALIZATION_ERROR,
      STORE_STATUS_INITIALIZED,
      NOT_SET,
      p, call, explodePromise, isPromise,
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

          this._setStatus(STORE_STATUS_NEW);
        }

        /**
         * props can be:
         *
         * 1: a function, in which case its the initializer.
         * 2: an object with state or initializer as props, in which case its a parameter group
         * 3. an object without state or initializer in which case its the firstState
         *
         * @param props
         * @private
         */

        _parseProps(props) {
          this._firstState = STORE_STATE_UNSET_VALUE;
          if (!props) return;
          if (typeof props === 'function') {
            props = { initializer: props };
          }
          let debug = false;
          let initializer = null;
          let firstState = STORE_STATE_UNSET_VALUE;
          let noChangeBeforeInit = false;

          if (typeof props === 'object') {
            if ('state' in props || 'initializer' in props) {
              initializer = lGet(props, 'initializer', initializer);
              firstState = lGet(props, 'state', firstState);
              debug = lGet(props, 'debug', debug);
              noChangeBeforeInit = lGet(props, 'noChangeBeforeInit', noChangeBeforeInit);
            } else {
              firstState = props;
            }

            this._firstState = firstState;
            this._initializer = initializer;
          } else {
            this._firstState = props;
          }

          this._noChangeBeforeInit = noChangeBeforeInit;
          this._debug = debug;
        }

        _initStateStream() {
          this._stateStream = new BehaviorSubject(this._firstState)
            .pipe(distinctUntilChanged());
          this._stateStream.subscribe((next) => {
            this._state = next;
          });
        }

        _initErrorStream() {
          this._errorStream = new BehaviorSubject()
            .pipe(distinctUntilChanged());
        }

        _initDebugStream() {
          this._debugStream = new BehaviorSubject()
            .pipe(map(data => Object.assign({}, data, {
              store_state: this.state, store_status: this.status,
            })));
          this._errorStream.subscribe((error) => {
            this._debugStream.next({
              source: '----(errorStream)',
              message: 'error',
              params: error,
            });
          });

          this._changeStream.subscribe((params) => {
            this._debugStream.next({
              source: '-----(changeStream)',
              message: 'params',
              params,
            });
          });

          this._stateStream.subscribe((state) => {
            this._debugStream.next({
              source: '----(stateStream)',
              message: 'state',
              params: state,
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
          return change
            .then((newChange) => {
              this._debugMessage('change stream', '============= resolved', { params, newChange });
              this._change(this._extendParams(params, { change: newChange }));
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
          this._change(this._extendParams(params, { change: params.change(this.state) }));
        }

        _extendParams(params, extension) {
          if (typeof params === 'function') {
            return this._extendParams({ change: params }, extension);
          }
          if (isPromise(params)) {
            return this._extendParams({ change: params }, extension);
          }

          const { done: oDone, fail: oFail } = params;
          const { done: eDone, fail: eFail } = extension;
          let done = oDone;
          let fail = oFail;

          if (eDone) {
            done = async (...args) => {
              await call(oDone, ...args);
              return eDone(...args);
            };
          }

          if (eFail) {
            fail = async (...args) => {
              await call(oFail, ...args);
              return eFail(...args);
            };
          }

          return Object.assign({}, params, extension, { done, fail });
        }

        _delayedChange(params) {
          // until status is updated changes are buffered
          this._debugMessage('change stream', 'delaying execution until initializing is done', params);
          this.onInit(params);
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
          this._changeStream.subscribe(params => this.onChange(params), (error) => {
            this._errorStream.next({
              message: 'change stream error',
              error,
            });
          });
        }

        onChange(params = NOT_SET) {
          if (params === NOT_SET) {
            return;
          }

          const {
            change = NOT_SET,
            done = NOT_SET,
            status,
          } = params;

          if (this.isInitializeError) {
            this._changeError(this.initializationError, params);
            return;
          }

          if (!change) {
            this._changeError(new Error('no change specified'), params);
            return;
          }

          if (this._noChangeBeforeInit && !status) {
            switch (this.status) {
              case STORE_STATUS_INITIALIZING:
                this._changeError(new Error('cannot process change before initialization'), params);
                return;
                break;

              case STORE_STATUS_NEW:
                this._changeError(new Error('cannot process change before initialization'), params);
                return;
                break;

              default:
              // continue;
            }
          }

          if (isPromise(change)) {
            this._resolveChangePromise(params);
            return;
          }

          if (typeof change === 'function') {
            this._resolveChangeFunction(params);
            return;
          }

          if (!this.isInitialized) {
            if (!status) {
              this._delayedChange(params);
              return;
            }
          }

          if (status) {
            this._setStatus(status);
          }

          this._setState(change);
          call(done, this.state);
        }

        _change(params) {
          this._debugMessage('_change', 'initial', params);
          const [promise, done, fail] = explodePromise();
          this._changeStream.next(this._extendParams(params, { done, fail }));
          return promise;
        }

        get state() {
          return this._state;
        }

        _setState(value = NOT_SET) {
          if (value !== NOT_SET) {
            this._stateStream.next(value);
          }
        }

        get status() {
          return this._status;
        }

        _setStatus(status) {
          if ([
            STORE_STATUS_NEW,
            STORE_STATUS_INITIALIZING,
            STORE_STATUS_INITIALIZED,
            STORE_STATUS_INITIALIZATION_ERROR,
          ].includes(status)) {
            this._status = status;
          }
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
          this._debugMessage('initialize', '==========initializing', {});
          if (this._initPromise) return this._initPromise;
          this._setState(this._firstState);
          this._setStatus(STORE_STATUS_INITIALIZING);
          if (this._initializer) {
            this._initPromise = this._change({
              change: this._initializer, status: STORE_STATUS_INITIALIZED,
            });
          } else {
            this._initPromise = this._change({
              change: this._firstState, status: STORE_STATUS_INITIALIZED,
            });
          }
          return this._initPromise;
        }

        onInit(params) {
          const {
            fail,
          } = params;

          if (this.isInitialized) {
            return this._change(params);
          }

          if (this.isInitializeError) {
            call(fail, this.initializationError);
            return Promise.reject(this.initializationError);
          }

          const [myDone, myFail, promise] = explodePromise();

          const sub = this._statusStream.subscribe(
            (status) => {
              switch (status) {
                case STORE_STATUS_INITIALIZED:
                  sub.unsubscribe();
                  this._change(this._extendParams(params, { done: myDone, fail: myFail }));
                  break;

                case STORE_STATUS_INITIALIZATION_ERROR:
                  sub.unsubscribe();
                  call(fail, this.initializationError, this);
                  myFail(this.initializationError);
                  break;

                default:
              }
            },
            (error) => {
              call(fail, error, this);
              myFail(error);
            },
          );

          return promise;
        }

        _debugMessage(source, message, params) {
          if (this._debug) {
            this._debugStream.next({
              source,
              message,
              params,
            });
          }
        }
      }

      return Store;
    },
  );
};
