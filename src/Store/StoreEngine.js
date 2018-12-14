import { combineLatest, Subject, from } from 'rxjs';
import { map } from 'rxjs/operators';
import lGet from 'lodash.get';
import cloneDeep from 'lodash.clonedeep';

const STATE_UNSET = Symbol('STATE_UNSET');

export default (bottle) => {
  bottle.factory(
    'StoreEngine',
    ({
      isPromise,
      Store, ACTION_START, ACTION_ERROR, ACTION_COMPLETE, p,
      BASE_STATE_STATUS_INITIALIZED,
    }) => {
      class StoreEngine extends Store {
        constructor(props, actions) {
          const mutators = actions || lGet(props, 'actions', lGet(props, 'effects', {}));
          delete props.actions;

          super(props);

          this.mutators = mutators;

          this._actionsStream = new Subject();

          this._actionStream = combineLatest(this._stream, this._actionsStream)
            .pipe(map(([state, action]) =>
              // console.log('state: ', state);
            //  console.log('action:', action);
              ({
                ...action,
                ...state,
              })));
        }

        set mutators(mutators) {
          this._mutators = mutators;
          this.actions = {};
          Object.keys(this.mutators)
            .forEach((name) => {
              this.actions[name] = (...params) => this.perform({
                name,
                params,
              });
            });
        }

        get mutators() {
          return this._mutators;
        }

        get effects() {
          return this.actions;
        }

        subscribeToActions(...args) {
          return this._actionStream.subscribe(...args);
        }

        _actionError({
          name, prevState, params = [], reject,
        }, error) {
          this._actionsStream.next({
            name,
            params,
            type: ACTION_ERROR,
            error,
          });
          if (reject) {
            reject(error);
          }
        }

        _actionComplete({
          name, params = [], prevState, resolve,
        }, state = STATE_UNSET) {
          if (state !== STATE_UNSET) {
            this.state = state;
          }
          const nextState = this.state;

          this._actionsStream.next({
            type: ACTION_COMPLETE,
            name,
            params,
            state: nextState,
            prevState,
          });

          resolve(state);
        }

        transactionID() {
          if (!this._tid) this.tid = 0;
          const tid = this._tid;
          this._tid += 1;
          return {
            tid,
            on: Date.now(),
          };
        }

        perform(props) {
          let resolve;
          let reject;
          const tid = this.transactionID();

          let {
            mutator, actions,
          } = props;

          const { name, params = [] } = props;

          let endProps = { ...props, tid };

          const outPromise = new Promise((good, bad) => {
            resolve = good;
            reject = bad;
            endProps = { ...endProps, resolve, reject };
          });

          this.onInit(() => {
            if (!mutator) mutator = this.mutators[name];
            if (!actions) actions = this.actions;

            if (!mutator) {
              this._actionError(endProps, new Error('cannot find mutator'));
              return;
            }

            this._actionsStream.next({
              name,
              params,
              type: ACTION_START,
            });

            const prevState = cloneDeep(this.state);
            endProps.prevState = prevState;
            let result;
            try {
              result = mutator(actions, ...params);
            } catch (error) {
              this._actionError(endProps, error);
            }

            if (!result) {
              this._actionComplete(endProps);
            } else if (isPromise(result)) {
              from(result)
                .subscribe(
                  (delta) => {
                    if (delta && (typeof delta === 'function')) {
                      this._actionComplete(endProps, delta(this.state));
                    } else {
                      // action is a no-op: it calls other actions but doesn't return/change anything.
                      // it might return something but as its not a function we ignore it.
                      this._actionComplete(endProps);
                    }
                  },
                  error => this._actionError(endProps, error),
                );
            } else if (typeof (result) === 'function') {
              this._actionComplete(endProps, result(this.state));
            } else {
              // action is a no-op: it calls other actions but doesn't return/change anything.
              this._actionComplete(endProps, STATE_UNSET);
            }
          });

          // note - this method will _execute synchronously_
          // unless your action returns a promise.
          // however it returns a promise that IN THE EVENT OF AN ASYNC ACTION
          // will complete when the action completes.

          return outPromise;
        }
      }

      return StoreEngine;
    },
  );
};
