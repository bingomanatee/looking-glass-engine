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
      STORE_STATUS_STOPPED,
      NOT_SET,
      Change,
      p, call, isPromise,
    }) => {
      class Store {
        constructor(props = null) {
          this._idFromProps(props);
          this._parseProps(props);

          this._initChangeStream();
          this._initStateStream();
          this._initErrorStream();
          this._initStream();


          if (this._debug) {
            this._initDebugStream();
          }

          this._setStatus(STORE_STATUS_NEW);
        }

        stop() {
          this._setStatus(STORE_STATUS_STOPPED);
          this._changeStream.complete();
          this._stateStream.complete();
          this._stream.complete();
          this._errorStream.complete();
          if (this._debugStream) this._debugStream.complete();
        }

        _idFromProps(props) {
          if (!Store._nextID) Store._nextID = 0;
          if (props) {
            const id = lGet(props, 'id');
            if ((id) && Number.isInteger(id) && (id >= Store._nextID)) {
              this.id = id;
              Store.nextID = id + 1;
              return;
            } else if (id && (typeof id === 'string')) {
              this.id = id;
            }
          }
          Store._nextID += 1;
          this.id = Store._nextID;
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
          this._idFromProps(props);
          this._firstState = STORE_STATE_UNSET_VALUE;
          if (!props) return;
          if (typeof props === 'function') {
            props = { initializer: props };
          }
          let debug = false;
          let initializer = null;
          let firstState = STORE_STATE_UNSET_VALUE;
          let noChangeBeforeInit = true;

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
            .pipe(map((data) => {
              const params = data.params;
              let change = null;
              if (params instanceof Change) {
                switch (params.type) {
                  case 'value':
                    if (typeof params.change === 'symbol') {
                      change = params.change.toString();
                    } else {
                      try {
                        change = JSON.stringify(params.change);
                      } catch (err) {
                        change = params.change;
                      }
                    }
                    break;

                  default:
                    change = `change -- ${params.type}`;
                }
                return Object.assign({}, data, {
                  store_state: this.state, store_status: this.status, change,
                });
              }
              return Object.assign({}, data, {
                store_state: this.state, store_status: this.status, params,
              });
            }));
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
              this.change({ ...params, change: newChange });
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
          this._debugMessage('_resolveChangeFunction', 'chaining', params);
          this.change({ ...params, change: params.change(this.state) });
        }

        /**
         * depracated; built into Change.
         *
         * @param params
         * @param extension
         * @returns {*}
         * @private
         */
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
              return call(eDone, ...args);
            };
          }

          if (eFail) {
            fail = async (...args) => {
              await call(oFail, ...args);
              return call(eFail, ...args);
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

          if (typeof params !== 'object') {
            this.onChange({ change: params });
            return;
          }

          const {
            change = NOT_SET,
            done,
            status,
          } = params;

          if (this.isInitializeError) {
            this._changeError(this.initializationError, params);
            return;
          }

          if (!params) {
            this._changeError(new Error('no change specified'), params);
            return;
          }

          if (this._noChangeBeforeInit && !status) {
            switch (this.status) {
              case STORE_STATUS_INITIALIZING:
                this._debugMessage('onChange', 'change before init -- suppressing', params);
                return;
                break;

              case STORE_STATUS_NEW:
                this._debugMessage('onChange', 'change while new -- suppressing', params);
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

          this._setState(change);

          if (status) {
            this._setStatus(status);
          }
          call(done, this.state);
        }

        change(params = NOT_SET) {
          if (params === NOT_SET) return Promise.resolve(NOT_SET);
          let init = params;
          if (typeof params === 'object' && (!params.change)) {
            init = { change: params };
          }
          const changeRecord = (params instanceof Change) ? params : new Change(init);
          const [change, promise] = changeRecord.asPromise();
          this._changeStream.next(change);
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
          return this._stateStream.subscribe(...args);
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
            this._initPromise = this.change({
              change: this._initializer, status: STORE_STATUS_INITIALIZED,
            });
          } else {
            this._initPromise = this.change({
              change: this._firstState, status: STORE_STATUS_INITIALIZED,
            });
          }
          return this._initPromise;
        }

        /**
         * this method delays an action until the store has been initialized
         * (or is in init error state).
         *
         * @param params {change} or legit arguments to the new change constructor.
         *
         * @returns {Promise<never>}
         */
        onInit(params) {
          const {
            fail,
          } = params;

          if (this.isInitialized) {
            return this.change(params);
          }

          if (this.isInitializeError) {
            call(fail, this.initializationError);
            return Promise.reject(this.initializationError);
          }

          let changeRecord;
          if (!(params instanceof Change)) {
            changeRecord = new Change(params);
          } else {
            changeRecord = params;
          }

          const [change, promise] = changeRecord.asPromise();

          const sub = this._statusStream.subscribe(
            (status) => {
              switch (status) {
                case STORE_STATUS_INITIALIZED:
                  sub.unsubscribe();
                  this.change(change);
                  break;

                case STORE_STATUS_INITIALIZATION_ERROR:
                  sub.unsubscribe();
                  call(change.fail, this.initializationError, this);
                  break;

                default:
              }
            },
            (error) => {
              call(change.fail, error, this);
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
