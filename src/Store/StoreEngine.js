import { combineLatest, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import lGet from 'lodash.get';

export default (bottle) => {
  bottle.factory(
    'StoreEngine',
    ({
      Store, ACTION_START, ACTION_ERROR, ACTION_COMPLETE, p,
    }) => {
      class StoreEngine extends Store {
        constructor(props, actions) {
          super(props);

          this._actionsStream = new Subject();

          this._actionStream = combineLatest(this._stream, this._actionsStream)
            .pipe(map(([store, action]) => ({
              ...store,
              ...action,
            })));

          this._actions = {};
          const lActions = actions || lGet(props, 'actions', {});
          Object.keys(lActions).forEach((actionName) => {
            this._actions[actionName] = async (...params) => this.do(actionName, lActions[actionName], ...params);
          });
        }

        get actions() {
          return this._actions;
        }

        subscribeToActions(...args) {
          return this._actionStream.subscribe(...args);
        }

        async do(name, fn, ...params) {
          await this.initialize();
          if (!this.actions[name]) {
            return this._actionsStream.next({
              type: ACTION_ERROR,
              name,
              error: { message: 'cannot find action' },
            });
          }

          this._actionsStream.next({
            name,
            params,
            type: ACTION_START,
          });

          const [state, error] = await p(fn, this, ...params);

          if (error) {
            this._actionsStream.next({
              name,
              params,
              type: ACTION_ERROR,
              error,
            });
            return this.state;
          }
          const prevState = this.state;
          this.state = state;
          this._actionsStream.next({
            type: ACTION_COMPLETE,
            name,
            params,
            state,
            prevState,
          });
          return state;
        }
      }

      return StoreEngine;
    },
  );
};
