/* eslint-disable no-unreachable */

import clone from 'lodash.clonedeep';

import { BehaviorSubject } from 'rxjs';

export default (bottle) => {
  bottle.factory('Store', ({
    STORE_STATE_UNSET_VALUE,
    STORE_STATUS_NEW,
    STORE_STATUS_STARTING,
    STORE_STATUS_INITIALIZATION_ERROR,
    STORE_STATUS_STOPPED,
    STORE_STATUS_STARTED,
    NOT_SET,
    ChangePromise,
    isPromise,
  }) => {
    /**
     * store is a record of a value that changes over time.
     * it's stateful. Until started (by calling store.start(),
     * non-status changing updates are delayed.
     *
     * Stores can be stopped, by calling store.stop()
     *
     */

    class Store {
      constructor(config = {}) {
        const {
          state = STORE_STATE_UNSET_VALUE, starter = NOT_SET, debug = false, actions = {},
        } = config;

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
          this._status = starter !== NOT_SET ? STORE_STATUS_NEW : STORE_STATUS_STARTED;
        } catch (err) {
          console.log('constructor error:', err);
          this.onError(err);
        }

        this.stream = new BehaviorSubject({
          state: this.state,
          status: this.status,
        });
      }

      /* ----------------- PROPERTIES --------------------- */

      get status() {
        return this._status;
      }

      get state() {
        return this._state;
      }

      /* ----------------- METHODS ------------------------ */


      addActions(mutators = {}) {
        const actions = this.actions || {};

        if (mutators && typeof mutators === 'object') {
          Object.keys(mutators).forEach(name => actions[name] = this.makeAction(actions, name, mutators[name]));
        } else {
          this.errorStream.next({
            source: 'addActions',
            message: 'bad mutators',
            mutators,
          });
        }

        this.actions = actions;
      }

      log(info) {
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

      delay(change) {
        this.log({
          source: 'delay',
          change,
        });
        const sub = this.stream.subscribe(() => {
          switch (this.status) {
            case STORE_STATUS_STARTED:
              sub.unsubscribe();
              this.update(change);
              break;

            case STORE_STATUS_INITIALIZATION_ERROR:
              sub.unsubscribe();
              change.reject(this.initializationError
                || new Error('initialization error before change resolved'));
              break;

            case STORE_STATUS_STOPPED:
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
       * resolve should only be hit during/after initialization is complete.
       * Due to promise delays, we still need to check post-init conditions.
       *
       * @param change {ChangePromise}
       * @returns {ChangePromise} (the input)
       */
      resolve(change) {
        this.log({ source: 'resolve', change });
        switch (this.status) {
          case STORE_STATUS_INITIALIZATION_ERROR:
            // stop
            change.reject(this.initializationError
              || new Error('initialization error before change resolved'));
            return change;
            break;

          case STORE_STATUS_STOPPED:
            change.reject(this.initializationError
              || new Error('store stopped before change resolved'));
            break;

          default:
          // continue;
        }

        if (typeof change.value === 'function') {
          const newState = change.value({
            state: this.state,
            actions: this.actions,
          });
          this.log({
            source: 'resolve', message: 'changing state value to function result:', newState, change,
          });
          change.value = newState;
          return this.resolve(change);
        }

        if (isPromise(change.value)) {
          change.value
            .then((unwrapped) => {
              change.value = unwrapped;
              this.resolve(change);
            })
            .catch((err) => {
              change.reject(err);
            });
          return change;
        }

        // -- end of the road!
        if (change.status) {
          this.log({ source: 'resolve', message: 'updating status', change });
          this._status = change.status;
        } else {
          this.log({ source: 'resolve', message: 'changing - no status change', change });
        }
        if (change.value !== NOT_SET) { this._state = change.value; }
        this.stream.next({
          status: this.status,
          state: this.state,
        });
        this.log({ source: 'resolve', message: 'stream updated', change });
        change.resolve(change.value);
        this.log({ source: 'resolve', message: 'change resolved', change });
        return change;
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
          this.log({ source: 'update', message: 'created ChangePromise', change });
        } else {
          this.log({ source: 'update', message: 'received ChangePromise', change });
        }

        if (change.status) {
          return this.resolve(change);
        }
        switch (this.status) {
          case NOT_SET:
            this.after('NotSet', 'status is not set');
            this.delay(change);
            break;

          case STORE_STATUS_STARTING:
            if (change.status) {
              return this.resolve(change);
            }
            this.delay(change);
            break;

          case STORE_STATUS_STARTED:
            return this.resolve(change);
            break;

          case STORE_STATUS_INITIALIZATION_ERROR:
            this.afterInitError({
              source: 'update',
              message: 'change requested of store after init error',
              change,
            });
            setTimeout(() => change.reject(new Error('change requested of errored store')));
            break;

          case STORE_STATUS_STOPPED:
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

      start() {
        this.log({ source: 'start' });

        if (!this._startPromise) {
          switch (this.status) {
            case STORE_STATUS_NEW:

              if (!this._starter) {
                this.log({ source: 'start', message: 'no starter - updating status' });
                this._startPromise = this.update(NOT_SET, { status: STORE_STATUS_STARTED });
              } else {
                if (typeof this._starter !== 'function') {
                  console.log('bad starter', this._starter, this);
                  this.onError('bad starter');
                  return Promise.reject('bad starter');
                }
                // synchronous status change;
                this.resolve(new ChangePromise(NOT_SET, { status: STORE_STATUS_STARTING }));
                this._startPromise = this.update(this._starter, { status: STORE_STATUS_STARTED });
              }
              break;

            case STORE_STATUS_STARTING:
              return Promise.reject(this.afterStart('tried to initialize after starting'));
              break;

            case STORE_STATUS_STARTED:
              return Promise.resolve(this.state);
              break;

            case STORE_STATUS_INITIALIZATION_ERROR:
              return Promise.reject(this.afterInitError('tried to initialize after error'));
              break;

            case STORE_STATUS_STOPPED:
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
          return this.update(value, { status: STORE_STATUS_STOPPED });
        }
        this._status = STORE_STATUS_STOPPED;
        return Promise.resolve(this.state);
      }

      onError() {
        this._status = STORE_STATUS_INITIALIZATION_ERROR;
        this.errorStream.next(new Error('bad starter'));
      }
    }

    return Store;
  });
};
