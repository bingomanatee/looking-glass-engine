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
      Store, Change,
    }) => {
      class Engine extends Store {
        constructor(params, actions) {
          super(params);
          this._initActionStream();
          this.mutators = actions || lGet(params, actions);
          this.initialize();
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

        onAction(changeRecord) {
          if (!changeRecord) return;
          this._debugMessage('onAction', '(init)', changeRecord);
          const {
            actionStatus = NOT_SET,
            change,
          } = changeRecord;

          if (!change) {
            if (actionStatus !== ACTION_ERROR) {
              this.actionStream.next(changeRecord.extend({
                actionStatus: ACTION_ERROR,
                error: new Error(`cannot find method ${lGet(changeRecord, 'method', '???')}`),
              }));
              return;
            }
          }

          if (actionStatus === ACTION_START) {
            this._debugMessage('onAction', 'chaining action call ', changeRecord);
            this._change(changeRecord.extend({
              done: () => {
                this.actionStream.next(changeRecord.extend({
                  actionStatus: ACTION_COMPLETE,
                }));
              },
              fail: (error) => {
                this.actionStream.next(changeRecord.extend({
                  error, actionStatus: ACTION_ERROR,
                }));
              },
              actionStatus: NOT_SET,
            }));
          } else if (actionStatus === ACTION_ERROR) {
            call(lGet(changeRecord, 'fail'));
          } else {
            this._debugMessage('onAction', 'NOT chaining action call ', changeRecord);
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
          const changeRecord = new Change({
            ...params,
            tid: this._getTID(),
            actionStatus: ACTION_START,
          });

          let {
            // eslint-disable-next-line prefer-const
            method, actions = this.actions, params: methodParams,
          } = changeRecord;
          const mutator = lGet(this.mutators, method);


          if (mutator && typeof mutator === 'function') {
            changeRecord.change = mutator(actions, ...methodParams);
          }
          this._debugMessage('perform', 'mutator:', changeRecord);
          const { promise, change: actionChange } = changeRecord.asPromise();

          this.actionStream.next(actionChange);

          return promise;
        }
      }

      return Engine;
    },
  );
};
