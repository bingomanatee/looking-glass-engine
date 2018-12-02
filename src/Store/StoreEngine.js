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
          const mutators = actions || lGet(props, 'actions', lGet(props, 'effects', {}));
          delete props.actions;

          super(props);

          this.mutators = mutators;

          this._actionsStream = new Subject();

          this._actionStream = combineLatest(this._stream, this._actionsStream)
            .pipe(map(([store, action]) => ({
              ...store,
              ...action,
            })));
        }

        set mutators(mutators) {
          this._mutators = mutators;
        }

        get mutators() {
          return this._mutators;
        }

        get effects() {
          return this.actions;
        }

        get actions() {
          return this.getActions();
        }

        getActions(actions = {}) {
          Object.keys(this.mutators).forEach((name) => {
            actions[name] = (...params) => this._execute(name, this.mutators[name], actions, params);
          });
          return actions;
        }

        subscribeToActions(...args) {
          return this._actionStream.subscribe(...args);
        }

        async _execute(name, mutator, actions = {}, params = []) {
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

          const [delta, error] = await p(mutator, { actions }, ...params);
          if (error) {
            this._actionsStream.next({
              name,
              params,
              type: ACTION_ERROR,
              error,
            });
          } else {
            const prevState = this.state;
            this.state = delta(this.state);
            this._actionsStream.next({
              type: ACTION_COMPLETE,
              name,
              params,
              state: this.state,
              prevState,
            });
          }
          return this.state;
        }
      }

      return StoreEngine;
    },
  );
};
