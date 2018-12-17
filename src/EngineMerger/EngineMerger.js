import { combineLatest, BehaviorSubject, from } from 'rxjs';
import { map, distinctUntilChanged, pairwise, filter } from 'rxjs/operators';
import lGet from 'lodash.get';
import lClone from 'lodash.clonedeep';

export default (bottle) => {
  bottle.factory('defaultActionReducer', () => function (engines) {
    if (Array.isArray(engines)) {
      return engines.reduce((actionsMemo, engine) => {
        // with an array, actions will shadow other actions of the
        // same name preferring right most engines. However all original
        // actions will be available in the baseActions array.
        let baseActions = actionsMemo.baseActions;
        if (baseActions) {
          baseActions = [...baseActions, engine.actions];
        } else {
          baseActions = [engine.actions];
        }
        const actions = { ...actionsMemo, baseActions };
        Object.keys(engine.mutators).forEach((method) => {
          actions[method] = (...params) => engine.perform({
            actions, method, params,
          });
        });
        return actions;
      }, {});
    } else if (typeof engines === 'object') {
      const baseActions = {};
      const actions = { baseActions };

      Object.keys(engines).forEach((engineName) => {
        const engine = engines[engineName];
        actions[engineName] = {};
        Object.keys(engine.mutators).forEach((method) => {
          const action = (...params) => engine.perform({
            actions, method, params,
          });
          actions[engineName][method] = action;
          actions[method] = action;
          actions.baseActions[method] = engine.actions[method];
        });
      });
      return actions;
    }
    throw new Error('bad engines for defaultActionReducer');
  });

  bottle.factory('defaultStateReducer', () => (states) => {
    if (Array.isArray(states)) {
      return states.reduce((newState, state) => ({ ...newState, ...state }), {});
    } else if (typeof states === 'object') {
      const newState = {};
      Object.keys(states).forEach((engineName) => {
        Object.keys(states[engineName]).forEach((fieldName) => {
          newState[fieldName] = states[engineName][fieldName];
        });
        Object.assign(newState, states);
      });
      return newState;
    }
    throw new Error('bad state passed to defaultStateReducer');
  });

  bottle.factory(
    'EngineMerger',
    ({
      STORE_STATE_UNSET_VALUE,
      STORE_STATUS_NEW,
      STORE_STATUS_INITIALIZING,
      STORE_STATUS_INITIALIZATION_ERROR,
      STORE_STATUS_INITIALIZED,

      defaultActionReducer,
      defaultStateReducer,
      ACTION_START,
      ACTION_COMPLETE,
      ACTION_ERROR,

      NOT_SET,
      p, call, isPromise, explodePromise,
      Store,
    }) => {
      class EngineMerger extends Store {
        constructor(params) {
          super(params);
          this.initialize();
        }

        _parseProps(params) {
          this.actions = lGet(params, 'actionReducer', defaultActionReducer)(lGet(params, 'engines', []));
          this._stateReducer = lGet(params, 'stateReducer', defaultStateReducer);
        }

        get actions() {
          if (!this._actions) {
            const actions = {};

            Object.keys(this.mutators)
              .forEach((method) => {
                actions[method] = (...params) => this.perform({
                  method,
                  actions,
                  params,
                });
              });

            this._actions = actions;
          }
          return this._actions;
        }

        _initActionStream() {
          this.actionStream = new BehaviorSubject();
          this.actionStream.subscribe(params => this.onAction(params), (error) => {
            this._errorStream.next({ message: 'action error', error });
          });
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
            this._change(this._extendParams(params, {
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
