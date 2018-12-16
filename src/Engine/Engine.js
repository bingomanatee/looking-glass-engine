import { combineLatest, BehaviorSubject, from } from 'rxjs';
import { map, distinctUntilChanged, pairwise, filter } from 'rxjs/operators';
import lGet from 'lodash.get';
import lClone from 'lodash.clonedeep';

export default (bottle) => {
  bottle.factory(
    'Engine',
    ({
      STORE_STATE_UNSET_VALUE,
      STORE_STATUS_NEW,
      STORE_STATUS_INITIALIZING,
      STORE_STATUS_INITIALIZATION_ERROR,
      STORE_STATUS_INITIALIZED,

      ACTION_START,
      ACTION_COMPLETE,
      ACTION_ERROR,

      NOT_SET,
      p, call,
      isPromise,
      Store,
    }) => {
      class Engine extends Store {
        constructor(params, actions) {
          super(params);
          this._initActionStream();
          this._mutators = actions || lGet(params, actions);
          this.initialize();
        }

        get actions() {
          if (!this._actions) {
            const actions = {};

            Object.keys(this._mutators)
              .forEach((method) => {
                actions[method] = (...params) => {
                  const change = this._mutators[method](actions, ...params);
                  // should usually be a function, or a promise
                  if (isPromise(change) || (typeof change === 'function')) {
                    return this._perform(method, change, params);
                  }
                  return Promise.resolve(NOT_SET);
                };
              });

            this._actions = actions;
          }
          return this._actions;
        }

        _initActionStream() {
          this.actionStream = new BehaviorSubject();
          this.actionStream.subscribe((action) => {
            if (action.actionStatus === ACTION_START) {
              this._change({
                change: action.change,
                done: () => {
                  this.actionStream.next({ ...action, actionStatus: ACTION_COMPLETE });
                },
                error: (error) => {
                  this._actionStream.next({
                    ...action, error, actionStatus: ACTION_ERROR,
                  });
                },
              });
            }
          });
        }

        _getTID() {
          if (!this._tid) {
            this._tid = 0;
          }
          this._tid += 1;
          return this._tid;
        }

        _perform(name, change, params) {
          if (this.isInitializeError) {
            call(params.fail, new Error('called action after initialization error', params));
            return;
          }

          if (!this.isInitialized) this.initialize();
          const tid = this._getTID();

          this.actionStream.next({
            change,
            actionStatus: ACTION_START,
            params,
            name,
            state: lClone(this.state),
            tid,
          });
        }
      }


      return Engine;
    },
  );
};
