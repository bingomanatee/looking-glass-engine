/* eslint-disable no-unreachable */

import clone from 'lodash.clonedeep';

import { BehaviorSubject } from 'rxjs';

export default (bottle) => {
  bottle.factory('Store', ({
    STORE_STATE_UNSET_VALUE,
    S_NEW,
    S_STARTING,
    S_ERROR,
    S_STOPPED,
    S_STARTED,
    NOT_SET,
    ChangePromise,
    isPromise,
    capFirst,
  }) => {
    /**
     * a Store is a record of a state that updates over time.
     *
     * It has a defined status indicating where in the initialization cycle it is:
     *
     * NEW > STARTING > STARTED
     *
     * note that stores without a starer function begin at STARTED (as start() is a no-op without
     * a starter function.
     *
     * and in some cases in a terminal "frozen" state
     *
     * > STOPPED | ERROR
     *
     * Stores can be stopped, by calling
     *
     *   store.stop()
     *
     * Stores can also be restarted to back out of a terminal state (> STARTED) by calling
     *
     *   store.restart(state?);
     *
     * Store updates and do are designed to handle a "mixed
     */

    class Store {
      constructor(config = {}) {
        let {
          state = STORE_STATE_UNSET_VALUE,
        } = config;

        const {
          starter = NOT_SET,
          propTypes = {},
          debug = false, actions = {},
        } = config;

        this._propTypes = propTypes;
        this._propsState = {};
        this._props = {};

        if (state === STORE_STATE_UNSET_VALUE && starter === NOT_SET) state = {};

        this.errorStream = new BehaviorSubject(false);

        try {
          this.addActions(actions);
          if (debug) {
            this.debugStream = new BehaviorSubject({
              source: 'constructor',
              config,
            });
          }
          this._state = state;
          this._starter = starter;
          this._status = starter !== NOT_SET ? S_NEW : S_STARTED;
        } catch (err) {
          this.onError(err);
        }

        this.stream = new BehaviorSubject({
          state: this.state,
          status: this.status,
        });
      }

      /* ----------------- PROPERTIES --------------------- */

      get actions() {
        return this._do;
      }

      set actions(actions) {
        this._do = actions;
      }

      get do() {
        return this._do;
      }

      set do(actions) {
        this._do = actions;
      }

      get status() {
        return this._status;
      }

      get _status() {
        return this.__status;
      }

      set _status(value) {
        if (![S_STARTED, S_STARTING, S_ERROR, S_NEW, S_STOPPED].includes(value)) {
          console.log('attempt to set status to ', value);
          throw new Error('bad value set for _status');
        }
        this.__status = value;
      }

      /**
       * if both _state and _propsState are objects,
       * merges _propsState into _state and empties _propsState.
       * @private
       */
      _mergePropsStateIntoState() {
        if (this._state && (this._state !== NOT_SET) && (typeof this._state === 'object')) {
          if (this._propsState && (this._state) && (typeof this._state === 'object')) {
            this._state = { ...this._state, ...this._propsState };
            this._propsState = false;
          }
        }
      }

      /**
       * NOTE ON STATE TYPE
       *
       * while this code doesn't explicitly force the type Object on state it also doesn't go
       * out of its way to insulate against non-object states. If you put non-objects into state,
       * happy debugging!
       *
       * It is better/safer in practice to put a single key object ({ value: myThing}) into state.
       *
       * Because there is something of a race condition between the starter completing
       * and the state being returned, we do a quick merge between them immediately before
       * returning state if _propsState exists and we are in S_STARTED status.
       *
       * yes: this is a "hack".
       *
       * @returns {variant}
       */
      get state() {
        if (this._propsState && this.status === S_STARTED) {
          this._mergePropsStateIntoState();
        }
        return this._state;
      }

      get validState() {
        return this.validator(this.state)[0];
      }

      get stateErrors() {
        return this.validator(this.state)[1];
      }

      get stateAndErrors() {
        const [state, errors] = this.validator(this.state);
        return {
          state,
          realState: this.state,
          errors,
        };
      }

      validator(state) {
        if (state === NOT_SET || (typeof state !== 'object')) return [state];

        let valid = true;
        const errors = {};


        Object.keys(this._props).forEach((name) => {
          const { type, test: propTest, valueIfTestFails = NOT_SET } = this._props[name];
          /**
           * note - currently type is a "toothless" field to indicate the type of value
           * a property should have - no code exists for validation.
           */
          if (name in state) {
            const error = propTest(state[name]);
            if (error) {
              valid = false;
              errors[name] = error;
              if (valueIfTestFails !== NOT_SET) state[name] = valueIfTestFails;
            }
          }
        });

        return [state, (!valid) && errors];
      }

      /* ----------------- METHODS ------------------------ */

      /**
       * an action is a function that takes optional arguments
       * and prepends the store snapshot in front of it. i.e.,
       *
       * myStore = new Store({
       *   state: {a: 4},}
       *   do: {
       *     addA:({state}, a) => ({...state, a: state.a + a})
       *   }
       * }
       *
       * myStore.do.addA(3);
       * // myStore.state.a === 7;
       *
       * The signature - what parts of state are pulled into the action signature are arguable.
       * Freactal, for instance separates the provision of state from the provision of do.
       * So an action function can return ....
       *
       *  - an object (the next state), OR
       *  - a function that takes ({do, state}) and returns .... ^ ^ OR
       *  - a Promise that returns ^ ^
       *
       *  updates keep "unwrapping" functions and promises
       *  til a non-function, non-promise is returned.
       *  note, if a function returns undefined (i.e., has no return statement), it is a "No - op";
       *  it will not change state _DIRECTLY_
       *  but it might do so indirectly by calling other do.
       */

      /**
       *
       * @param actionsMap {Object} a hash of name/function | value parameters.
       */

      addActions(actionsMap = {}) {
        const actions = this.actions || {};

        if (actionsMap && typeof actionsMap === 'object') {
          Object.keys(actionsMap).forEach((name) => {
            const mutator = actionsMap[name];
            actions[name] = this.makeAction(name, mutator);
          });
        } else {
          this.errorStream.next({
            source: 'addActions',
            message: 'bad actionsMap',
            mutators: actionsMap,
          });
        }

        this.actions = actions;
      }

      addAction(name, method) {
        this.actions[name] = this.makeAction(name, method);
        return this;
      }

      /**
       *
       * @param name
       * @param mutator
       * @returns {function(...[*]): ChangePromise}
       */
      makeAction(name, mutator) {
        if (typeof mutator !== 'function') {
          mutator = () => mutator;
        }
        return (...args) => this.update(() => mutator(this, ...args), { action: name || true });
      }

      /**
       * takes (or creates) a ChangePromise (which it returns)
       * and attempts to trigger a state change.
       *
       * NOTE: although a promise is returned, change is SYNCHRONOUS unless:
       *
       * a) the store is not initialized AND the change doesn't change status,
       *    in which case it is delayed;
       * b) the change is itself a promise, in which case change occurs when it is resolved.
       *
       * @param change {variant}
       * @param info {Object} -- metadata; includes potentally a status change.
       * @returns {ChangePromise}
       */
      update(change, info = NOT_SET) {
        if (!(change instanceof ChangePromise)) {
          change = new ChangePromise(change, info);
          this._log({ source: 'update', message: 'created ChangePromise', change });
        } else {
          this._log({ source: 'update', message: 'received ChangePromise', change });
        }

        if (change.status) {
          return this._resolve(change);
        }

        switch (this.status) {
          case NOT_SET:
            this.after('NotSet', 'status is not set');
            this._delay(change);
            break;

          case S_STARTING:
            if (change.status) {
              return this._resolve(change);
            }
            this._delay(change);
            break;

          case S_STARTED:
            return this._resolve(change);
            break;

          case S_ERROR:
            this.afterInitError({
              source: 'update',
              message: 'change requested of store after init error',
              change,
            });
            setTimeout(() => change.reject(new Error('change requested of errored store')));
            break;

          case S_STOPPED:
            this.afterStop({
              source: 'update',
              message: 'change requested to stopped store',
              change,
            });
            setTimeout(() => change.reject(new Error('change requested of stopped store')));
            break;

          default:
            console.log('unknown status:', this.status);
            change.reject(new Error(`change cannot resolve - state in unknown status ${this.status.toString()}`));
        }

        return change;
      }

      _delay(change) {
        this._log({
          source: '_delay',
          change,
        });
        const sub = this.stream.subscribe(() => {
          switch (this.status) {
            case S_STARTED:
              sub.unsubscribe();
              this.update(change);
              break;

            case S_ERROR:
              sub.unsubscribe();
              change.reject(this.initializationError
                || new Error('initialization error before change resolved'));
              break;

            case S_STOPPED:
              sub.unsubscribe();
              change.reject(this.initializationError
                || new Error('store stopped before change resolved'));
              break;

            default:
            // noop;
          }
        });
        return change;
      }

      /**
       * _resolve should only be hit during/after initialization is complete.
       * Due to promise delays, we still need to check post-init conditions.
       *
       * @param change {ChangePromise}
       * @returns {ChangePromise} (the input)
       */
      _resolve(change) {
        this._log({ source: '_resolve', change });
        switch (this.status) {
          case S_ERROR:
            // stop
            change.reject(this.initializationError
              || new Error('initialization error before change resolved'));
            return change;
            break;

          case S_STOPPED:
            change.reject(this.initializationError
              || new Error('store stopped before change resolved'));
            break;

          default:
          // continue;
        }

        if (typeof change.value === 'function') {
          let newState;
          try {
            newState = change.value({
              state: this.state,
              do: this.do,
            });
          } catch (error) {
            this._log({
              source: '_resolve',
              message: 'error from change function',
              error,
            });

            change.reject(error);
            // this.onError?
            this.errorStream.next({ error, change });
            return change;
          }
          this._log({
            source: '_resolve',
            message: 'changing state value to function result:',
            newState,
            change,
          });
          change.value = newState;
          return this._resolve(change);
        }

        if (isPromise(change.value)) {
          change.value
            .then((unwrapped) => {
              change.value = unwrapped;
              this._resolve(change);
            })
            .catch((err) => {
              change.reject(err);
            });
          return change;
        }

        // -- end of the road!
        if (change.status && change.status !== NOT_SET) {
          this._log({ source: '_resolve', message: 'updating status', change });
          this._status = change.status;
        }

        if (change.value !== NOT_SET && (typeof change.value !== 'undefined')) {
          this._state = change.value;
        }
        this.stream.next({
          status: this.status,
          state: this.state,
        });
        this._log({ source: '_resolve', message: 'stream updated', change });
        change.resolve(change.value);
        this._log({ source: '_resolve', message: 'change resolved', change });
        return change;
      }

      afterStart(info) {
        return this.after('Start', info);
      }

      afterStop(info) {
        return this.after('Stop', info);
      }

      afterInitError(info) {
        return this.after('InitError', info);
      }

      after(what, info = 'tried to change') {
        if (typeof info === 'string') {
          return this.after(what, new Error(info));
        }
        if (!what) what = this._status.toString();
        this.errorStream.next({ source: `after${what}`, error: info });
        return info;
      }

      /**
       * this method is designed mainly to "back out" of an errored state.
       * @param value
       */

      restart(value = NOT_SET) {
        let out;
        switch (this.status) {
          // note: for non-error transient states, the value input is ignored..
          case S_NEW:
            out = this.start();
            break;

          case S_STARTING:
            out = this._startPromise;
            break;

          case S_STARTED:
            out = this._startPromise || Promise.resolve(this.state);
            break;

            /* ----------- THESE ARE THE CONDITIONS THIS METHOD IS MEANT TO ADDRESS ---------- */

          case S_ERROR:
            out = this.update(value, { status: S_STARTED });
            break;

          case S_STOPPED:
            out = this.update(value, { status: S_STARTED });
            break;

          case NOT_SET:
            out = this.update(value, { status: S_STARTED });
            break;

          default:
            out = this.update(value, { status: S_STARTED });
        }

        this._startPromise = out;
        return out;
      }

      /**
       * activate whatever starter methods (if any) exist.
       * note the promise returns the state UPON INTIALIZATION but that value shouldn't be taken
       * as canon as it might not be up to date.
       *
       * @returns {*}
       */
      start() {
        this._log({ source: 'start' });

        if (!this._startPromise) {
          switch (this.status) {
            case S_NEW:

              if (!this._starter) {
                this._log({ source: 'start', message: 'no starter - updating status' });
                this._startPromise = this.update(NOT_SET, { status: S_STARTED });
              } else {
                if (typeof this._starter !== 'function') {
                  this.onError('bad starter');
                  return Promise.reject(new Error('bad starter'));
                }
                // synchronous status change;
                this._resolve(new ChangePromise(NOT_SET, { status: S_STARTING }));
                this._startPromise = this.update(this._starter, { status: S_STARTED });
              }
              break;

              /* ------------ MOST OF THESE ARE NEVER GOING TO HAPPEN ----------- */

            case S_STARTING:
              // REALLY should never happen - startPromise should be set now
              return Promise.reject(this.afterStart('tried to initialize after starting'));
              break;

            case S_STARTED:
              this._startPromise = Promise.resolve(this.state);
              break;

            case S_ERROR:
              console.log('bad store:', this);
              return Promise.reject(this.afterInitError('tried to initialize after error'));
              break;

            case S_STOPPED:
              return Promise.reject(this.afterStop('tried to initialize after stopped'));
              break;

            default:
              console.log('strange status: ', this.status);
              return Promise.reject(new Error(`strange status: ${this.status.toString()}`));
          }
        }

        return this._startPromise;
      }

      /**
       *
       * suspends future changes. Optionally accepts one final state change.
       *
       * @param value {variant} optional. if present, sets the state to a final value.
       *
       * @returns {ChangePromise | Promise}
       */
      stop(value) {
        if (value) {
          return this.update(value, { status: S_STOPPED });
        }
        this._status = S_STOPPED;
        return Promise.resolve(this.state);
      }

      onError() {
        this._status = S_ERROR;
        this.errorStream.next(new Error('bad starter'));
      }

      _log(info) {
        if (this.debugStream) {
          try {
            this.debugStream.next({
              ...info,
              status: this.status,
              state: clone(this.state),
            });
          } catch (err) {
            this.debugStream.next({
              info,
              status: this.status,
              state: this.state,
              _cloneError: err,
            });
          }
        }
      }

      /** ------------------ PROPERTY BASED DEFINITION --------------------- */

      /**
       * as an alternative to configuration based state definition you can define
       * property based values for the store. This lets you set the default value
       * and setter do for values in your store in a single step.
       */

      addProp(name, definition = {}) {
        if (typeof name === 'object') {
          Object.keys(name).forEach((key) => {
            const def = name[key];
            this.addProp(key, def);
          });
          return this;
        }

        const {
          type = '*', start = null, test = () => false, valueIfTestFails = null,
        } = definition;

        let { setter = NOT_SET } = definition;

        this._props[name] = {
          type, test, valueIfTestFails,
        };

        /**
         * if we are in STARTED status, patch the property start value into the state stream.
         * Otherwise buffer the start values into _propsState, a "future state buffer"
         * designed to support the condition where there is no defined state start
         * (before starter completes).
         */
        switch (this.status) {
          case S_STARTED:
            this.update(({ state }) => ({ ...state, [name]: start }), {});
            break;

          default:
            if (!this._propsState) this._propsState = {};
            this._propsState[name] = start;
        }

        if (setter === NOT_SET) {
          setter = `set${capFirst(name)}`;
        }

        if (!this.do[setter]) {
          this.do[setter] = this.makeAction(setter, ({ state }, value) => {
            const out = { ...state };
            out[name] = value;
            return out;
          });
        }
        return this;
      }
    }

    return Store;
  });

  bottle.constant('capFirst', string => string[0].toUpperCase() + string.slice(1));
};
