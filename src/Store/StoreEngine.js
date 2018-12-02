import { combineLatest, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import lGet from 'lodash.get';
import cloneDeep from 'lodash.clonedeep';

export default (bottle) => {
  bottle.factory(
    'StoreEngine',
    ({
      Store, ACTION_START, ACTION_ERROR, ACTION_COMPLETE, p, BASE_STATE_STATUS_INITIALIZED,
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
          this.actions = {};
          Object.keys(this.mutators).forEach((name) => {
            this.actions[name] = (...params) => this.perform({ name, params });
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

        async perform({
          name, mutator, actions, params = [],
        }) {
          if (this.status !== BASE_STATE_STATUS_INITIALIZED) await this.initialize();
          if (!mutator) mutator = this.mutators[name];
          if (!actions) actions = this.actions;

          if (!mutator) {
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

          const [delta, error] = await p(mutator, actions, ...params);

          if (error) {
            this._actionsStream.next({
              name,
              params,
              type: ACTION_ERROR,
              error,
            });
          } else {
            const prevState = cloneDeep(this.state);
            if (delta && (typeof delta === 'function')) {
              this.state = delta(this.state);
            }
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
