/* eslint-disable no-undef,prefer-promise-reject-errors */
import { combineLatest, BehaviorSubject, Observable, from, fork } from 'rxjs';
import { map, distinctUntilChanged, pairwise, filter } from 'rxjs/operators';
import lGet from 'lodash.get';
import lClone from 'lodash.clonedeep';
import lGroupBy from 'lodash.groupby';

export default (bottle) => {
  bottle.factory(
    'EngineMerger',
    ({
      STORE_STATUS_NEW,
      STORE_STATUS_INITIALIZING,
      STORE_STATUS_INITIALIZATION_ERROR,
      STORE_STATUS_INITIALIZED,
      STORE_STATE_UNSET_VALUE,

      defaultActionReducer,
      defaultStateReducer,
      ACTION_START,
      ACTION_COMPLETE,
      ACTION_ERROR,

      NOT_SET,
      p, call, isPromise, explodePromise, obj, timeLimitObservable,
      Store,
    }) => {
      const STATUS_MAP = new Map();
      STATUS_MAP.set(STORE_STATUS_NEW, 'new');
      STATUS_MAP.set(STORE_STATUS_INITIALIZATION_ERROR, 'error');
      STATUS_MAP.set(STORE_STATUS_INITIALIZED, 'initialized');
      STATUS_MAP.set(STORE_STATUS_INITIALIZING, 'initializing');
      STATUS_MAP.set(NOT_SET, 'other');

      class EngineMerger extends Store {
        constructor(params) {
          super(params);
          this._initActionStream();

          this.initialize();
        }

        _parseProps(params) {
          this._idFromProps(params);

          this.engines = lGet(params, 'engines', []);
          this._stateReducer = lGet(params, 'stateReducer', defaultStateReducer);
          this._actionsReducer = lGet(params, 'actionReducer', defaultActionReducer);
          this._firstState = lGet(params, 'state', STORE_STATE_UNSET_VALUE);
          this._maxInitWait = lGet(params, 'maxInitWait', 10 * 1000);
          this._listenToEngineStreams();
          this._debug = lGet(params, 'debug', params);
        }

        get actions() {
          if (!this._actions) {
            this._actions = this._actionsReducer(this.engines);
          }
          return this._actions;
        }

        _listenToEngineStreams() {
          this.enginesArray.forEach(e => e.subscribe(() => {
            this._updateState();
          }, (err) => {
            console.log('error on ', e, err);
          }, () => {
            console.log('engine shut down');
          }));
        }

        _updateState() {
          if (this.status === STORE_STATUS_INITIALIZED) {
            this._stateStream.next(this._stateReducer(this.states));
          }
        }

        _initActionStream() {
          this.actionStream = new BehaviorSubject();
          this.actionStream.subscribe(params => this.onAction(params), (error) => {
            this._errorStream.next({ message: 'action error', error });
          });
        }

        initialize() {
          this._debugMessage('initialize', '========== initializing', {});
          if (this._initPromise) return this._initPromise;

          this.change({ change: this._firstState || STORE_STATE_UNSET_VALUE, status: STORE_STATUS_INITIALIZING });

          this._initPromise = this.change({
            status: STORE_STATUS_INITIALIZED,
            change: this._waitEngineInit(),
          });

          return this._initPromise;
        }

        async _waitEngineInit() {
          let responded = false;
          this._debugMessage('_waitEngineInit', 'initializing', this.engines);
          const obsList = this.enginesArray.map((engine) => {
            if (engine.isInitialized) {
              return null;
            }
            this._debugMessage('_waitEngineInit', 'watching engine', engine.id);
            const stateWatcher = new BehaviorSubject(engine.status);
            engine.subscribe(() => {
              stateWatcher.next(engine.status);
            }, (error) => {
              stateWatcher.error(error);
            }, () => {
            });

            return stateWatcher;
          }).filter(o => o !== null);

          if (obsList.length < 1) {
            return this._stateReducer(this.states);
          }

          return new Promise((done, fail) => {
            combineLatest(obsList).subscribe((result) => {
              if (responded) return;
              let finished = true;
              result.forEach((value) => {
                if (responded) return;
                switch (value) {
                  case STORE_STATUS_INITIALIZED:
                    // do nothing;
                    break;

                  case STORE_STATUS_INITIALIZING:
                    finished = false;
                    break;

                  case STORE_STATUS_INITIALIZATION_ERROR:
                    finished = false;
                    responded = true;
                    fail();
                    break;

                  default:
                    finished = false;
                    responded = true;
                    fail();
                    // some error
                }
              });
              if (finished) {
                responded = true;
                done(this._stateReducer(this.states));
              }
            }, (error) => {
              if (responded) return;
              responded = true;
              fail({
                status: STORE_STATUS_INITIALIZATION_ERROR,
                change: this.state,
                error,
              });
            }, () => {
              if (responded) return;
              responded = true;
              this._debugMessage('_waitEngineInit', 'result complete: ', result);
              done(this._stateReducer(this.states));
            });
          });
        }

        get engineKeys() {
          return Object.keys(this.engines).sort();
        }

        get states() {
          if (Array.isArray(this.engines)) return this.engines.map(e => e.state);
          if (typeof this.engines === 'object') {
            // eslint-disable-next-line arrow-body-style
            return this.engineKeys.reduce((memo, key) => {
              return ({ ...memo, ...obj(key, this.engines[key].state) });
            }, {});
          }
          console.log('this engines is not right:', this.engines);
          return STORE_STATE_UNSET_VALUE;
        }

        get enginesArray() {
          if (Array.isArray(this.engines)) {
            return this.engines.slice(0);
          }
          if (typeof this.engines === 'object') {
            return this.engineKeys.reduce((memo, key) => [...memo, this.engines[key]], []);
          }
          return [];
        }

        get statesArray() {
          return this.enginesArray.map(e => e.state);
        }

        onAction(params) {
          if (!params) return;
          this._debugMessage('onAction', '(init)', params);
          const {
            actionStatus = NOT_SET,
            change,
          } = params;

          if (!change) {
            if (actionStatus !== ACTION_ERROR) {
              this.actionStream.next(Object.extend({}, params, {
                actionStatus: ACTION_ERROR,
                error: new Error(`cannot find method ${lGet(params, 'method', '???')}`),
              }));
              return;
            }
          }

          if (actionStatus === ACTION_START) {
            this._debugMessage('onAction', 'chaining action call ', params);
            this.change(this._extendParams(params, {
              done: () => {
                this.actionStream.next(Object.assign({}, params, {
                  actionStatus: ACTION_COMPLETE,
                }));
              },
              fail: (error) => {
                this.actionStream.next(Object.assign({}, params, {
                  error, actionStatus: ACTION_ERROR,
                }));
              },
              actionStatus: NOT_SET,
            }));
          } else if (actionStatus === ACTION_ERROR) {
            call(lGet(params, 'fail'));
          } else {
            this._debugMessage('onAction', 'NOT chaining action call ', params);
          }
        }

        _getTID() {
          if (!this._tid) {
            this._tid = 0;
          }
          this._tid += 1;
          return this._tid;
        }

        perform(params) {
          const [promise, done, fail] = explodePromise();
          let {
            // eslint-disable-next-line prefer-const
            method, change, actions = this.actions, params: methodParams,
          } = params;
          const mutator = lGet(this.mutators, method, NOT_SET);

          if (mutator) change = mutator(actions, ...methodParams);

          const tid = this._getTID();

          this._debugMessage('perform', 'mutator:', {
            mutator,
            params,
            change,
            tid,
          });

          this.actionStream.next(this._extendParams(params, {
            done,
            fail,
            tid,
            change,
            actionStatus: ACTION_START,
          }));
          return promise;
        }
      }


      return EngineMerger;
    },
  );
};
