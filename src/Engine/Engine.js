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
      p, call, isPromise, explodePromise,
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
          const mutator = lGet(this._mutators, method, NOT_SET);

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


      return Engine;
    },
  );
};
